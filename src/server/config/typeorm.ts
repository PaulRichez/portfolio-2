import { ConnectionOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config();

export const typeOrmConfig: ConnectionOptions = {
  type: 'postgres',
  host: process.env['DB_HOST'], // Utilisation de la notation par crochets
  port: parseInt(process.env['DB_PORT'] || '5432'),
  username: process.env['DB_USERNAME'],
  password: process.env['DB_PASSWORD'],
  database: process.env['DB_DATABASE'],
  synchronize: true,
  logging: true,
  entities: [
    __dirname + './../models/*.ts',
  ],
  migrations: [
    __dirname + '/migrations/*.ts',
  ],
  subscribers: [
    __dirname + '/subscribers/*.ts',
  ],
};
