import { DataTypes } from 'sequelize';

export default function defineBoxCash(sequelize) {
  return sequelize.define('BoxCash', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    isActived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'boxCash',
    timestamps: true,
    underscored: false,
  });
}