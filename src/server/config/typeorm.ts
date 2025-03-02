import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config();

// Fonction pour s'assurer que les variables sont bien définies
const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`❌ Missing environment variable: ${key}`);
  }
  return value || defaultValue!;
};

export const AppDataSource = new DataSource({
  type: "postgres",
  host: getEnv("DB_HOST", "localhost"),
  port: parseInt(getEnv("DB_PORT", "5432"), 10),
  username: getEnv("DB_USERNAME", "postgres"),
  password: getEnv("DB_PASSWORD", "password"),
  database: getEnv("DB_NAME", "portfolio"),
  synchronize: true,
  logging: getEnv("DB_LOGGING", "false") === "true",
  entities: [__dirname + "/../models/**/*.{ts,js}"],
  migrations: [__dirname + "/../migrations/*.{ts,js}"],
  subscribers: [__dirname + "/../subscribers/*.{ts,js}"],
  migrationsTableName: "migrations",
});

if (!AppDataSource.isInitialized) {
  AppDataSource.initialize()
    .then(() => console.log("📦 TypeORM connecté à la base de données !"))
    .catch((error) => console.error("❌ Erreur de connexion TypeORM :", error));
}
