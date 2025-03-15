require('dotenv').config();

exports.up = async function(knex) {
  await knex.schema.createTable("me", (table) => {
    table.increments("id").primary();
    table.string("last_name");
    table.string("first_name");
    table.string("city");
    table.date("birth_day");
    table.string("phone_number");
    table.string("email");
    table.string("post_name");
    table.string("linkedin");
    table.string("github");
    table.string("website");
  });

  await knex.schema.createTable("coding_skills", (table) => {
    table.increments("id").primary();
    table.string("key");
    table.integer("value");
  });

  await knex.schema.createTable("knowledge", (table) => {
    table.increments("id").primary();
    table.string("name");
  });

  await knex.schema.createTable("languages", (table) => {
    table.increments("id").primary();
    table.string("key");
    table.integer("value");
  });

  await knex.schema.createTable("diplomas", (table) => {
    table.increments("id").primary();
    table.date("start_date");
    table.date("end_date").nullable();
    table.string("title");
    table.string("description");
  });

  await knex.schema.createTable("experiences", (table) => {
    table.increments("id").primary();
    table.date("start_date");
    table.date("end_date").nullable();
    table.string("job");
    table.string("business");
    table.string("business_website");
    table.text("descriptions"); // Stored as stringified JSON
  });

  // Initial data seeding
  await knex("me").insert({
    last_name: "Richez",
    first_name: "Paul",
    city: "Lille",
    birth_day: "1992-09-08",
    phone_number: "07 77 30 19 65",
    email: "paul.richez59@gmail.com",
    post_name: "Développeur web",
    linkedin: "https://www.linkedin.com/in/paul-richez/",
    github: "https://github.com/PaulRichez",
    website: "https://paulrichez.fr",
  });

  await knex("coding_skills").insert([
    { key: "HTML", value: 80 },
    { key: "CSS", value: 75 },
    { key: "Javascript", value: 75 },
    { key: "Docker", value: 60 },
    { key: "Java", value: 50 },
  ]);

  await knex("knowledge").insert(
    ["html-1", "css-3", "javascript-1", "vue-9", "angular-icon", "bootstrap-5-1", "nodejs-icon", "git-icon", "jenkins-1", "firebase-1", "strapi-2"].map(name => ({ name }))
  );

  await knex("languages").insert([
    { key: "Français", value: 100 },
    { key: "Anglais", value: 40 },
  ]);

  await knex("diplomas").insert([
    { start_date: "2012-01-01", end_date: "2013-01-01", title: "Licence Professionnelle Informatique de Gestion", description: "Université de Valenciennes" },
    { start_date: "2010-01-01", end_date: "2012-01-01", title: "BTS Informatique de Gestion Option Développeur d'Applications", description: "Lycée Henri Wallon, Valenciennes" },
    { start_date: "2010-01-01", title: "Baccalauréat STI Option Génie Electrotechnique", description: "Lycée Paul Duez, Cambrai" },
  ]);

  await knex("experiences").insert([
    { start_date: "2023-04-11", end_date: null, job: "Développeur Fullstack", business: "Rewayz", business_website: "https://rewayz.com", descriptions: JSON.stringify(["Développement d'une plateforme web avec Angular et Strapi"]) },
    { start_date: "2020-07-07", end_date: "2021-05-01", job: "Développeur", business: "E-Mothep Consultants", business_website: "https://e-mothep.fr", descriptions: JSON.stringify(["Développement d'interfaces web avec Angular2+"]) },
    { start_date: "2019-10-01", end_date: "2020-07-01", job: "Ingénieur d'études web et multimédia", business: "JetDev", business_website: "https://www.jetdev.fr", descriptions: JSON.stringify(["Développement d'une interface web avec Angular2+", "Utilisation de Java (Spring boot) et de AgGrid", "Méthodologie agile"]) },
    { start_date: "2017-11-01", end_date: "2019-09-01", job: "Développeur", business: "Elosi", business_website: "https://www.elosi.com", descriptions: JSON.stringify(["Développement d'un site web en AngularJS en front avec quelques notions de back-end en JAVA et Elasticsearch", "Intégration de flux avec Webmethods.", "Création d'API rest avec Webmethods.", "Développement de cockpit avec Angular2+", "Utiisation de Firebase", "Utiisation de nodeJs"]) },
    { start_date: "2014-07-01", end_date: "2016-10-01", job: "Concepteur - Développeur", business: "CIM", business_website: "https://www.sa-cim.fr", descriptions: JSON.stringify(["Correction et évolution d'un prologiciel de gestion en Powerbuilder."]) },
  ]);
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("experiences");
  await knex.schema.dropTableIfExists("diplomas");
  await knex.schema.dropTableIfExists("languages");
  await knex.schema.dropTableIfExists("knowledge");
  await knex.schema.dropTableIfExists("coding_skills");
  await knex.schema.dropTableIfExists("me");
};