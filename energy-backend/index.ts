import { Sequelize } from 'sequelize';
import app from './app';

const port = 3000;
const sequelize = new Sequelize(process.env.DATABASE_URI!,
  {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {}
  });

const appInstance = app(sequelize);

// Listen on port 3000
appInstance.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
