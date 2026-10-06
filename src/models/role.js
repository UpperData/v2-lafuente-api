import { DataTypes } from 'sequelize';

export default function defineRole(sequelize) {
  return sequelize.define('Role', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.STRING(255) },
    menu: { type: DataTypes.JSONB, allowNull: false },
    isActived: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'roles',
    timestamps: true,
    underscored: false,
  });
}