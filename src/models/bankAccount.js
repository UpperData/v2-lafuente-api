import { DataTypes } from 'sequelize';

export default function defineBankAccount(sequelize) {
  return sequelize.define('BankAccount', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    accountNumber: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    holder: { type: DataTypes.STRING(60), allowNull: false },
    bankId: { type: DataTypes.INTEGER, allowNull: false },
    method: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['Banco', 'Zelle', 'Binance', 'Pago Movil', 'Crypto', 'Paypal', 'Stripe']],
      },
    },
    isActived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'bankAccount',
    timestamps: true,
    underscored: false,
  });
}