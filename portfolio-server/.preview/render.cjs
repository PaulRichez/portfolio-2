const fs = require('fs');
const path = require('path');
const ReactPDF = require('@react-pdf/renderer');
const { buildCvDocument, prepareCvPhoto } = require('./cv-document');

// Données RÉELLES (reconstruites depuis .tmp/data.db) pour coller au rendu live.
const C = (name, category) => ({ coding: { name, category } });
const me = {
  firstName: 'Paul', lastName: 'Richez', postName: 'Développeur Fullstack',
  city: 'Lille', birthDay: '1992-09-08',
  email: 'paul.richez59@gmail.com', phoneNumber: '07 77 30 19 65',
  website: 'https://paulrichez.fr', github: 'https://github.com/PaulRichez',
  linkedin: 'https://www.linkedin.com/in/paul-richez/',
  _photoSrc: path.join(process.cwd(), 'public', 'cv-photo.jpg'),
  coding_skills: [
    C('HTML', 'frontend_languages'), C('CSS', 'frontend_languages'), C('JavaScript', 'frontend_languages'),
    C('Angular', 'frontend_frameworks'), C('React', 'frontend_frameworks'), C('Vue.js', 'frontend_frameworks'),
    C('Strapi', 'backend'), C('Node.js', 'backend'), C('Java', 'backend'),
    C('PostgreSQL', 'databases'), C('Docker', 'tools'),
    C('Ollama', 'ai'), C('LangChain', 'ai'), C('Zhipu AI', 'ai'), C('ChromaDB', 'ai'),
    C('PrimeNG', 'frontend_libraries'), C('Nebular', 'frontend_libraries'), C('ECharts', 'frontend_libraries'),
    C('Webmethods', 'other_languages'), C('Powerbuilder', 'other_languages'),
  ],
  languages: [{ name: 'Français', value: 100 }, { name: 'Anglais', value: 40 }],
  experiences: [
    { title: 'Développeur Fullstack', business: 'Rewayz', startDate: '2023-04-11', endDate: null,
      descriptions: ["Développement d'une plateforme web avec Angular et Strapi"] },
    { title: 'Développeur', business: 'E-Mothep Consultants', startDate: '2020-07-07', endDate: '2021-05-01',
      descriptions: ["Développement d'interfaces web avec Angular2+"] },
    { title: "Ingénieur d'études web et multimédia", business: 'JetDev', startDate: '2019-10-01', endDate: '2020-07-01',
      descriptions: ["Développement d'une interface web avec Angular2+", 'Utilisation de Java (Spring boot) et de AgGrid', 'Méthodologie agile'] },
    { title: 'Développeur', business: 'Elosi', startDate: '2017-11-01', endDate: '2019-09-01',
      descriptions: ["Développement d'un site web en AngularJS en front avec quelques notions de back-end en JAVA et Elasticsearch", 'Intégration de flux avec Webmethods.', "Création d'API rest avec Webmethods.", 'Développement de cockpit avec Angular2+', 'Utilisation de Firebase', 'Utilisation de nodeJs'] },
    { title: 'Concepteur - Développeur', business: 'CIM', startDate: '2014-07-01', endDate: '2016-10-01',
      descriptions: ["Correction et évolution d'un progiciel de gestion en Powerbuilder."] },
  ],
  diplomas: [
    { title: 'Licence Professionnelle Informatique de Gestion', startDate: '2012-01-01', endDate: '2013-01-01', description: 'Université de Valenciennes' },
    { title: "BTS Informatique de Gestion Option Développeur d'Applications", startDate: '2010-01-01', endDate: '2012-01-01', description: 'Lycée Henri Wallon, Valenciennes' },
    { title: 'Baccalauréat STI Option Génie Electrotechnique', startDate: '2009-01-01', endDate: '2010-01-01', description: 'Lycée Paul Duez, Cambrai' },
  ],
};

(async () => {
  me._photoPng = await prepareCvPhoto(me._photoSrc);
  const buf = await ReactPDF.renderToBuffer(buildCvDocument(me));
  fs.writeFileSync(path.join(__dirname, '..', 'cv-preview.pdf'), buf);
  const s = buf.toString('latin1');
  const pages = (s.match(/\/Type\s*\/Page(?![s])/g) || []).length;
  console.log(`OK ${Math.round(buf.length / 1024)}Ko · pages=${pages}`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
