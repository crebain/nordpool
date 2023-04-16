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
}

main().catch((error) => {
    console.error(error);
});
