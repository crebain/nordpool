import { DefaultAzureCredential } from "@azure/identity";
import { CosmosClient } from "@azure/cosmos";
import process from 'process';

process.env.TZ = 'Europe/Oslo';

const endpoint = "https://nordpool-ahead-hourly.documents.azure.com:443/";
const databaseName = 'nordpool';
const containerName = 'hourly';
const vilniusFormat = new Intl.DateTimeFormat('sv-SE',
    {
        timeZone: 'Europe/Vilnius',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'longOffset'
    })

function getVilniusISOString(date) {
    const parts = vilniusFormat.formatToParts(date);
    var tzOffset = parts[12].value.slice(3); // Remove GMT from GMT+03:00
    return `${parts[0].value}-${parts[2].value}-${parts[4].value}T${parts[6].value}:${parts[8].value}:${parts[10].value}${tzOffset}`;
}

function printTsvResults(latestResultRows) {
    latestResultRows.filter(r => !r.IsExtraRow).forEach(row => {
        const startTime = new Date(Date.parse(row.StartTime));
        const endTime = new Date(Date.parse(row.EndTime));
        const csvRow = [getVilniusISOString(startTime), getVilniusISOString(endTime), row.Columns[0].Value];
        console.log(csvRow.join('\t'));
    });
}

async function main() {
    const credential = new DefaultAzureCredential();
    const options = { endpoint, aadCredentials: credential };
    const client = new CosmosClient(options);
    const database = client.database(databaseName);
    const container = database.container(containerName);
    const response = await container.items.query('SELECT * FROM c')
    const iterator = response.getAsyncIterator();

    try {

        let latestResultDate = "2022-11-29T00:00:00";
        let latestResultRows = null;

        const csvHeaders = ['StartTime', 'EndTime', 'EUR/MWh'];
        console.log(csvHeaders.join('\t'));

        for await (const element of iterator) {
            if (element.response.data.LatestResultDate != latestResultDate && latestResultRows != null) {
                printTsvResults(latestResultRows);
            }

            latestResultRows = element.response.data.Rows;
            latestResultDate = element.response.data.LatestResultDate;
            // console.log(element);
        }

        printTsvResults(latestResultRows);
    }
    catch (error) {
        console.error(`Inner: ${error}`);
    }

}

process.on('unhandledRejection', e => {
    console.error(`Unhandled rejection ${e}`);
});


try {
    await main();
}
catch (error) {
    console.error(`Outer: ${error}`);
}

process.exit();
