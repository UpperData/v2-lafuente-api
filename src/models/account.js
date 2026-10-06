import { DataTypes } from 'sequelize';
import { createDefaultCalendarSession } from '../constants/calendarSession.js';

export default function defineAccount(sequelize) {
  return sequelize.define('Account', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
    phoneNumber: { type: DataTypes.STRING(255), allowNull: false },
    pass: { type: DataTypes.STRING(255), allowNull: false },
    isActived: { type: DataTypes.BOOLEAN, defaultValue: true },
    tokenRestart: { type: DataTypes.STRING(255) },
    person: { type: DataTypes.JSONB, allowNull: false },
    roleId: { type: DataTypes.INTEGER, allowNull: false },
    calendarSession: { type: DataTypes.JSONB, defaultValue: createDefaultCalendarSession() },
  }, {
    tableName: 'accounts',
    timestamps: true,
    underscored: false,
  });
}