import { DataTypes } from 'sequelize';

export default function defineTransaction(sequelize) {
  return sequelize.define('Transaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reserveAccountId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(255), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currencyMode: { type: DataTypes.STRING(255) },
    originPayData: { type: DataTypes.JSONB, allowNull: false },
    destinationPayData: { type: DataTypes.JSONB, allowNull: false },
    reference: { type: DataTypes.STRING(100) },
    condition: { type: DataTypes.STRING(20) },
    isPayConfirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    operatorId: { type: DataTypes.INTEGER, allowNull: false },
    isActived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    comissions: { type: DataTypes.JSONB },
    note: { type: DataTypes.STRING(150) },
    deliveryDate: { type: DataTypes.DATE },
    isDiscountComissionInMount: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    audit: { type: DataTypes.JSONB, allowNull: false },
    evidence: { type: DataTypes.TEXT },
    cashList: { type: DataTypes.JSONB },
  }, {
    tableName: 'transactions',
    timestamps: true,
    underscored: false,
  });
}