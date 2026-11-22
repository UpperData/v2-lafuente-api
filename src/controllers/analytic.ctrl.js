import { models } from '../config/database.js';
import { Op } from 'sequelize';
export const getIncomingTransactions = async (request, response) => {
  try {
    const bankAccounts = await models.BankAccount.findAll({
      where: {
        balance: {
          //[Op.gt]: 0,
           //[Op.lte]:
            [Op.lt]:0
        },
      },
      attributes: ['id', 'accountNumber', 'holder', 'bankId', 'method', 'currencyMoney', 'balance'],
    });

    const accountsWithTransactions = await Promise.all(bankAccounts.map(async (bankAccount) => {
      const bankAccountId = bankAccount.id;
      const transaction = await models.Transaction.findAll({
        attributes:{exclude:['file', 'payData', 'comissions']},
        where: {
          isActived: true,
          [Op.or]: [
            {
              payData: {
                [Op.contains]: {
                  destinationAccount: { bankAccountId },
                },
              },
            },
            {
              payData: {
                [Op.contains]: {
                  destinationAccount: { bankAccountId: String(bankAccountId) },
                },
              },
            },
          ],
        },
        include: [
         
          {
            model: models.Account,
            as: 'operator',
            attributes: ['id', 'person'],
          },
          {
            model: models.ReserveAccount,
            as: 'reserveAccount',
            attributes: ['id', 'firstName', 'lastName'],
          }
        ],
      });
      const transactionsWithOperatorName = transaction.map((tx) => {
        const transactionData = tx.toJSON();
        const person = transactionData.operator && transactionData.operator.person;
        const operatorName = person
          ? [person.firstName, person.lastName].filter(Boolean).join(' ')
          : null;

        return {
          ...transactionData,
          operatorName,
        };
      });
      // agregar nombre del cliente(reserveAccount.firstName, reserveAccount.lastName) de la cuenta de reserva
      const transactionsWithOperatorNameAndReserveAccount = transactionsWithOperatorName.map((tx) => {
        const transactionData = tx;
        const reserveAccount = transactionData.reserveAccount;
        const reserveAccountName = reserveAccount
          ? [reserveAccount.firstName, reserveAccount.lastName].filter(Boolean).join(' ')
          : null;
          return {
            ...transactionData,
            reserveAccountName,
          };
      });
      // eliminar la propiedad operator del objeto transaction
      transactionsWithOperatorName.forEach((tx) => {
        delete tx.operator;
      });
      return {
        ...bankAccount.toJSON(),
        transaction: transactionsWithOperatorNameAndReserveAccount,
      };
    }));

    response.json({ bankAccounts: accountsWithTransactions });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Error al obtener las cuentas bancarias y sus transacciones.' });
  }
};