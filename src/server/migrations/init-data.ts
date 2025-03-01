import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsertPortfolioData1677679184046 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Inserting portfolio data...');
    // Insérer les données dans la table `me`
    await queryRunner.query(`
      INSERT INTO "me" (
        "lastName", "firstName", "city", "birthDay", "phoneNumber", "email", "postName", "linkedin", "github", "website"
      )
      VALUES (
        'Richez', 'Paul', 'Lille', '1992-09-08', '07 77 30 19 65', 'paul.richez59@gmail.com', 'Développeur web',
        'https://www.linkedin.com/in/paul-richez/', 'https://github.com/PaulRichez', 'https://paulrichez.fr'
      );
    `);

    // Insérer les compétences en codage
    await queryRunner.query(`
      INSERT INTO "coding" ("key", "value")
      VALUES
        ('HTML', 80),
        ('CSS', 75),
        ('Javascript', 75),
        ('Docker', 60),
        ('Java', 50);
    `);

    // Insérer les connaissances
    await queryRunner.query(`
      INSERT INTO "knowledge" ("key")
      VALUES
        ('html-1'),
        ('css-3'),
        ('javascript-1'),
        ('vue-9'),
        ('angular-icon'),
        ('bootstrap-5-1'),
        ('nodejs-icon'),
        ('git-icon'),
        ('jenkins-1'),
        ('firebase-1'),
        ('strapi-2');
    `);

    // Insérer les langues
    await queryRunner.query(`
      INSERT INTO "languages" ("key", "value")
      VALUES
        ('Français', 100),
        ('Anglais', 40);
    `);

    // Insérer les diplômes
    await queryRunner.query(`
      INSERT INTO "diplomas" ("startDate", "endDate", "title", "description")
      VALUES
        ('2012-01-01', '2013-01-01', 'Licence Professionnelle Informatique de Gestion', 'Université de Valenciennes'),
        ('2010-01-01', '2012-01-01', 'BTS Informatique de Gestion Option Développeur d\'Applications', 'Lycée Henri Wallon, Valenciennes'),
        ('2010-01-01', NULL, 'Baccalauréat STI Option Génie Electrotechnique', 'Lycée Paul Duez, Cambrai');
    `);

    // Insérer les expériences professionnelles
    await queryRunner.query(`
      INSERT INTO "experiences" ("startDate", "endDate", "job", "business", "businessWebsite", "descriptions")
      VALUES
        ('2023-04-11', NULL, 'Développeur Fullstack', 'Rewayz', 'https://rewayz.com', '{"Développement d\'une plateforme web avec Angular et Strapi"}'),
        ('2020-07-07', '2021-05-01', 'Développeur', 'E-Mothep Consultants', 'https://e-mothep.fr', '{"Développement d\'interfaces web avec Angular2+"}'),
        ('2019-10-01', '2020-07-01', 'Ingénieur d\'études web et multimédia', 'JetDev', 'https://www.jetdev.fr', '{"Développement d\'une interface web avec Angular2+", "Utilisation de Java (Spring boot) et de AgGrid", "Méthodologie agile"}'),
        ('2017-11-01', '2019-09-01', 'Développeur', 'Elosi', 'https://www.elosi.com', '{"Développement d\'un site web en AngularJS en front avec quelques notions de back-end en JAVA et Elasticsearch", "Intégration de flux avec Webmethods.", "Création d\'API rest avec Webmethods.", "Développement de cockpit avec Angular2+", "Utiisation de Firebase", "Utiisation de nodeJs"}'),
        ('2014-07-01', '2016-10-01', 'Concepteur - Développeur', 'CIM', 'https://www.sa-cim.fr', '{"Correction et évolution d\'un prologiciel de gestion en Powerbuilder."}');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Annuler les insertions si nécessaire
    await queryRunner.query('DELETE FROM "me"');
    await queryRunner.query('DELETE FROM "coding"');
    await queryRunner.query('DELETE FROM "knowledge"');
    await queryRunner.query('DELETE FROM "languages"');
    await queryRunner.query('DELETE FROM "diplomas"');
    await queryRunner.query('DELETE FROM "experiences"');
  }
}
