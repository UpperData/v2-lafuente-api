import defineAccount from './account.js';
import defineBank from './bank.js';
import defineBankAccount from './bankAccount.js';
import defineBoxCash from './boxCash.js';
import defineReserveAccount from './reserveAccount.js';
import defineRole from './role.js';
import defineTransaction from './transaction.js';

export function initModels(sequelize) {
	const Account = defineAccount(sequelize);
	const Bank = defineBank(sequelize);
	const BankAccount = defineBankAccount(sequelize);
	const BoxCash = defineBoxCash(sequelize);
	const ReserveAccount = defineReserveAccount(sequelize);
	const Role = defineRole(sequelize);
	const Transaction = defineTransaction(sequelize);

	Account.belongsTo(Role, {
		as: 'role',
		foreignKey: 'roleId',
		onUpdate: 'CASCADE',
		onDelete: 'SET NULL',
	});
	Role.hasMany(Account, { as: 'accounts', foreignKey: 'roleId' });

	BankAccount.belongsTo(Bank, {
		as: 'bank',
		foreignKey: 'bankId',
		onUpdate: 'CASCADE',
	});
	Bank.hasMany(BankAccount, { as: 'bankAccounts', foreignKey: 'bankId' });

	Transaction.belongsTo(Account, {
		as: 'operator',
		foreignKey: 'operatorId',
		onUpdate: 'CASCADE',
	});
	Account.hasMany(Transaction, { as: 'operatedTransactions', foreignKey: 'operatorId' });

	Transaction.belongsTo(ReserveAccount, {
		as: 'reserveAccount',
		foreignKey: 'reserveAccountId',
		onUpdate: 'CASCADE',
	});
	ReserveAccount.hasMany(Transaction, { as: 'transactions', foreignKey: 'reserveAccountId' });

	return { Account, Bank, BankAccount, BoxCash, ReserveAccount, Role, Transaction };
}

export default initModels;
