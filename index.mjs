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
    });

class NumberParser {
    constructor(locale) {
        const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
        const numerals = [...new Intl.NumberFormat(locale, { useGrouping: false }).format(9876543210)].reverse();
        const index = new Map(numerals.map((d, i) => [d, i]));
        this._group = new RegExp(`[${parts.find(d => d.type === "group").value}]`, "g");
        this._decimal = new RegExp(`[${parts.find(d => d.type === "decimal").value}]`);
        this._numeral = new RegExp(`[${numerals.join("")}]`, "g");
        this._index = d => index.get(d);
    }
    parse(string) {
        return (string = string.trim()
            .replace(this._group, "")
            .replace(this._decimal, ".")
            .replace(this._numeral, this._index)) ? +string : NaN;
    }
}

const nordpoolNumbers = new NumberParser('sv-SE');

function getVilniusISOString(date) {
    const parts = vilniusFormat.formatToParts(date);
    var tzOffset = parts[12].value.slice(3); // Remove GMT from GMT+03:00
    return `${parts[0].value}-${parts[2].value}-${parts[4].value}T${parts[6].value}:${parts[8].value}:${parts[10].value}${tzOffset}`;
}

function printTsvResults(latestResultRows) {
    latestResultRows.filter(r => !r.IsExtraRow).forEach(row => {
        const startTime = new Date(Date.parse(row.StartTime));
        const endTime = new Date(Date.parse(row.EndTime));
        const csvRow = [getVilniusISOString(startTime), getVilniusISOString(endTime), nordpoolNumbers.parse(row.Columns[0].Value)];
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

        for await (const page of iterator) {
            for (const element of page.resources) {
                if (element.response.data.LatestResultDate != latestResultDate && latestResultRows != null) {
                    printTsvResults(latestResultRows);
                }

                latestResultRows = element.response.data.Rows;
                latestResultDate = element.response.data.LatestResultDate;
                // console.log(element);
            }
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
