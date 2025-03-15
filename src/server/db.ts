import knex from "knex";

// Utilisation de require pour éviter le problème de typage
const config = require("../../knexfile");

const environment = "production";
export const db = knex(config[environment]);
