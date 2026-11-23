import { DataTypes } from 'sequelize';

export default function defineBoxCash(sequelize) {
  return sequelize.define('BoxCash', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(60), allowNull: false },
    balance: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    isActived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    currencyMoney: {
      type: DataTypes.ENUM('Dolar', 'Bolivar', 'Euro'),
      allowNull: false,
      defaultValue: 'Dolar',
    },
  }, {
    tableName: 'boxCash',
    timestamps: true,
    underscored: false,
    indexes: [
      {
        name: 'boxCash_currencyMoney_unique',
        unique: true,
        fields: ['currencyMoney'],
      },
    ],
    hooks: {
      beforeValidate(boxCash) {
        if (!boxCash.name) {
          const currency = boxCash.currencyMoney || 'Dolar';
          boxCash.name = `La Fuentes - cash - ${currency}`;
        }
      },
      beforeBulkCreate(records) {
        for (const boxCash of records) {
          if (!boxCash.name) {
            const currency = boxCash.currencyMoney || 'Dolar';
            boxCash.name = `La Fuentes - cash - ${currency}`;
          }
        }
      },
    },
  });
}