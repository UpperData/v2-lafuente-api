import { DataTypes } from 'sequelize';

export default function defineReserveAccount(sequelize) {
  return sequelize.define('ReserveAccount', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    documentId: { type: DataTypes.STRING(60) },
    firstName: { type: DataTypes.STRING(60) },
    LastName: { type: DataTypes.STRING(60) },
    isFamele: { type: DataTypes.BOOLEAN },
    email: { type: DataTypes.STRING(150) },
    phoneNumber: { type: DataTypes.STRING(20) },
    address: { type: DataTypes.STRING(255) },
    isActived: { type: DataTypes.BOOLEAN, defaultValue: true },
    currentBalance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'reserveAccounts',
    timestamps: true,
    underscored: false,
  });
}