import { DataTypes } from 'sequelize';

export default function defineGoal(sequelize) {
  return sequelize.define('Goal', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reserveAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'reserveAccounts', key: 'id' },
    },
    targetAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    currentAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currencyMoney: {
      type: DataTypes.ENUM('Dolar', 'Bolivar','Euro'),
      allowNull: false,
    },
    modality: {
      type: DataTypes.ENUM('Efectivo', 'Transferencia'),
      allowNull: false,
    },
    condition: {
      type: DataTypes.ENUM('Vigente', 'Pausada', 'Cumplida', 'Cancelada'),
      allowNull: false,
      defaultValue: 'Vigente',
    },
    dateLimit: { type: DataTypes.DATEONLY, allowNull: true },
    isActived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'goals',
    timestamps: true,
    underscored: false,
  });
}
