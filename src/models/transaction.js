import { DataTypes } from 'sequelize';

export default function defineTransaction(sequelize) {
  return sequelize.define('Transaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    amountNeto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    amountBrute: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    reserveAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'reserveAccounts', key: 'id' },
    },
    type: {
      type: DataTypes.ENUM('input', 'output'),
      allowNull: false,
    },
    currencyMoney: {
      type: DataTypes.ENUM('Dolar', 'Bolivar','Euro'),
      allowNull: false,
    },
    payData: { type: DataTypes.JSONB },
    reference: { type: DataTypes.STRING(50) },
    isPayConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    operatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'accounts', key: 'id' },
    },
    comissions: { type: DataTypes.JSON },
    isActived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    note: { type: DataTypes.STRING(250) },
    isComissionInMount: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    payDate: { type: DataTypes.DATEONLY },
    file: { type: DataTypes.BLOB },
  }, {
    tableName: 'transactions',
    timestamps: true,
    underscored: false,
  });
}