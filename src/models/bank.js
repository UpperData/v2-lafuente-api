import { DataTypes } from 'sequelize';

export default function defineBank(sequelize) {
  return sequelize.define('Bank', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    isActived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'banks',
    timestamps: true,
    underscored: false,
  });
}