import { DefaultAzureCredential } from "@azure/identity";
import { CosmosClient } from "@azure/cosmos";

const endpoint = "https://nordpool-ahead-hourly.documents.azure.com:443/";
const databaseName = 'nordpool';
const containerName = 'hourly';
const credential = new DefaultAzureCredential();
const options = { endpoint, aadCredentials: credential };
const client = new CosmosClient(options);
const database = client.database(databaseName);
const container = database.container(containerName);

async function main() {
    const { resources } = await container.items.query('SELECT * FROM c')
        .fetchAll();

    let latestResultDate = "2022-11-29T00:00:00";
    let latestResultRows = null;

    const csvHeaders = ['DATE CE(S)T', ...Array(24).keys()].map(i => String(i).padStart(2, '0'));
    console.log(csvHeaders.join('\t'));

    resources.forEach(element => {
        if (element.response.data.LatestResultDate != latestResultDate && latestResultRows != null) {
            const csvRow = [latestResultDate, ...latestResultRows.filter(r => !r.IsExtraRow).map(row => row.Columns[0].Value)];
            console.log(csvRow.join('\t'));
        }

        latestResultRows = element.response.data.Rows;
        latestResultDate = element.response.data.LatestResultDate;
        // console.log(element);
    });

    const csvRow = [latestResultDate, ...latestResultRows.filter(r => !r.IsExtraRow).map(row => row.Columns[0].Value)];
    console.log(csvRow.join('\t'));
}

main().catch((error) => {
    console.error(error);
});
