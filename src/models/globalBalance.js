import { DataTypes } from 'sequelize';

export default function defineGlobalBalance(sequelize) {
  return sequelize.define('GlobalBalance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    currencyMoney: {
      type: DataTypes.ENUM('Dolar', 'Bolivar', 'Euro'),
      allowNull: false,
      unique: true,
    },
    currentBalanceCash: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currentBalanceTransfer: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'globalBalances',
    timestamps: true,
    underscored: false,
  });
}
