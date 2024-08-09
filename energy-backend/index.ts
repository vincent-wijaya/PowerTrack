import { Sequelize } from 'sequelize';
import app from './app';

const port = 3001;
const sequelize = new Sequelize(process.env.DATABASE_URI!, {
  dialect: 'postgres',
  protocol: 'postgres',
  define: { timestamps: false }, // remove created and updated timestamps from models
  dialectOptions: {},
});

const appInstance = app(sequelize);

// Open server
appInstance.listen(process.env.SERVER_PORT, () => {
  console.log(`Server is running on port ${process.env.SERVER_PORT}`);
});
