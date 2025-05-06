import { processTransaction, BadRequestError } from "./process";
import { db } from "@/lib/db";
import { generateEncryptionKey, decryptString } from "@/lib/encryption";
import { selectLotsForSale, type CostBasisMethod } from "@/lib/cost-basis";
import { transactionSchema } from "@/schemas/transaction-schema"; // Used implicitly via parsing

// --- Mocking Setup ---

// Mock dependencies used by processTransaction
jest.mock('@/lib/db', () => ({
  db: {
    bitcoinTransaction: { create: jest.fn() },
    lot: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    allocation: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/encryption', () => ({
  generateEncryptionKey: jest.fn(),
  decryptString: jest.fn(),
}));
jest.mock('@/lib/cost-basis', () => ({
  selectLotsForSale: jest.fn(),
}));

// Get mock references
const mockDb = jest.requireMock('@/lib/db').db;
const mockEncryption = jest.requireMock('@/lib/encryption');
const mockCostBasis = jest.requireMock('@/lib/cost-basis');

// --- Test Suite ---
describe('processTransaction Service', () => {
  const TEST_USER_ID = 'user-svc-123';
  const TEST_PASSPHRASE = 'svc-test-pass';
  const TEST_ACCOUNTING_METHOD: CostBasisMethod = 'FIFO';
  const MOCK_ENCRYPTION_KEY = Buffer.from('mock-key-1234567890123456789012'); // Dummy key
  const MOCK_SESSION = {
    user: { 
      id: TEST_USER_ID, 
      encryptionPhrase: TEST_PASSPHRASE, 
      accountingMethod: TEST_ACCOUNTING_METHOD 
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();
    // Default mock implementations
    mockEncryption.generateEncryptionKey.mockResolvedValue(MOCK_ENCRYPTION_KEY);
    // Setup $transaction mock to execute callback by default
    mockDb.$transaction.mockImplementation(async (callback: any) => {
       const prismaMock = {
         allocation: { create: mockDb.allocation.create },
         lot: { update: mockDb.lot.update },
       };
       return await callback(prismaMock);
    });
  });

  // --- Failure Cases ---

  it('should throw BadRequestError if passphrase missing', async () => {
    const body = { timestamp: new Date().toISOString(), encryptedData: 'data' };
    const sessionWithoutPhrase = { user: { id: TEST_USER_ID, encryptionPhrase: '' } };
    await expect(processTransaction(body, sessionWithoutPhrase as any))
      .rejects.toThrow(new BadRequestError("Encryption key setup incomplete."));
  });

  it('should throw BadRequestError on invalid body wrapper schema', async () => {
    const invalidBody = { wrong: 'format' }; // Missing fields
    await expect(processTransaction(invalidBody as any, MOCK_SESSION))
      .rejects.toThrow(BadRequestError); // Check type, message might be verbose
  });

  it('should throw BadRequestError on decryption failure', async () => {
    const body = { timestamp: new Date().toISOString(), encryptedData: 'bad-data' };
    mockEncryption.decryptString.mockRejectedValue(new Error('fail'));
    await expect(processTransaction(body, MOCK_SESSION))
      .rejects.toThrow(new BadRequestError("Decryption failed. Invalid key or data?"));
  });

  it('should throw BadRequestError if decrypted data is not JSON', async () => {
    const body = { timestamp: new Date().toISOString(), encryptedData: 'good-data' };
    mockEncryption.decryptString.mockResolvedValue('not json');
    await expect(processTransaction(body, MOCK_SESSION))
      .rejects.toThrow(new BadRequestError("Decrypted data is not valid JSON"));
  });

  it('should throw BadRequestError if decrypted data fails transaction schema', async () => {
    const body = { timestamp: new Date().toISOString(), encryptedData: 'good-data' };
    const invalidPayload = { type: 'invalid' };
    mockEncryption.decryptString.mockResolvedValue(JSON.stringify(invalidPayload));
    await expect(processTransaction(body, MOCK_SESSION))
      .rejects.toThrow(BadRequestError); // Check type, message includes details
    // Optionally: Check that the error message contains specifics about validation failure
    try {
      await processTransaction(body, MOCK_SESSION);
    } catch (e: any) {
      expect(e.message).toContain("Invalid transaction data after decryption");
    }
  });

  // --- Success Cases ---

  it('should process a BUY transaction successfully', async () => {
    const timestamp = new Date();
    const buyPayload = { timestamp: timestamp, type: 'buy', amount: 1, price: 50000, fee: 10, notes: 'buy note', tags: [], wallet: 'w1' };
    const encryptedData = 'encrypted-buy-data';
    const body = { timestamp: timestamp.toISOString(), encryptedData };
    mockEncryption.decryptString.mockResolvedValue(JSON.stringify(buyPayload));

    const mockCreatedTx = { id: 'tx-buy-success', timestamp: timestamp, amount: 1, price: 50000, type: 'buy' };
    mockDb.bitcoinTransaction.create.mockResolvedValue(mockCreatedTx);
    mockDb.lot.create.mockResolvedValue({}); // Mock lot creation success

    const result = await processTransaction(body, MOCK_SESSION);

    expect(result).toEqual({ id: mockCreatedTx.id });
    expect(mockDb.bitcoinTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockDb.bitcoinTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: TEST_USER_ID,
        type: 'buy',
        amount: buyPayload.amount,
        price: buyPayload.price,
        timestamp: timestamp, 
        encryptedData: encryptedData
      })
    });
    expect(mockDb.lot.create).toHaveBeenCalledTimes(1);
    expect(mockDb.lot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
         txId: mockCreatedTx.id, 
         costBasisUsd: 50000, 
         originalAmount: 1,
         remainingQty: 1,
         openedAt: timestamp
      })
    });
  });

  it('should process a SELL transaction successfully', async () => {
    const timestamp = new Date();
    const sellPayload = { timestamp: timestamp, type: 'sell', amount: 0.5, price: 60000, fee: 5, notes: 'sell note', tags: [], wallet: 'w1' };
    const encryptedData = 'encrypted-sell-data';
    const body = { timestamp: timestamp.toISOString(), encryptedData };
    mockEncryption.decryptString.mockResolvedValue(JSON.stringify(sellPayload));

    const mockCreatedTx = { id: 'tx-sell-success', timestamp: timestamp, amount: 0.5, price: 60000, type: 'sell' };
    mockDb.bitcoinTransaction.create.mockResolvedValue(mockCreatedTx);

    const mockOpenLots = [{ id: 'lot1', openedAt: new Date(timestamp.getTime() - 10000), originalAmount: 1, remainingQty: 1, costBasisUsd: 50000 }];
    mockDb.lot.findMany.mockResolvedValue(mockOpenLots);

    const mockSaleResult = { selectedLots: [{ id: 'lot1', amountUsed: 0.5, remaining: 0.5, costBasis: 25000, proceeds: 30000, realizedGain: 5000, isLongTerm: false }] };
    mockCostBasis.selectLotsForSale.mockReturnValue(mockSaleResult);

    mockDb.allocation.create.mockResolvedValue({});
    mockDb.lot.update.mockResolvedValue({});

    const result = await processTransaction(body, MOCK_SESSION);

    expect(result).toEqual({ id: mockCreatedTx.id });
    expect(mockDb.bitcoinTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockDb.lot.findMany).toHaveBeenCalledTimes(1);
    expect(mockCostBasis.selectLotsForSale).toHaveBeenCalledTimes(1);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    
    // Add a check for the selected lot before using its properties in assertions
    const firstSelectedLot = mockSaleResult.selectedLots[0];
    if (!firstSelectedLot) {
        throw new Error("Test setup error: mockSaleResult.selectedLots[0] is undefined");
    }

    // Check calls *inside* transaction mock
    expect(mockDb.allocation.create).toHaveBeenCalledTimes(1);
    // Use objectContaining on the data property for allocation create
    expect(mockDb.allocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lotId: 'lot1',
        qty: 0.5,
        txId: mockCreatedTx.id,
        costUsd: firstSelectedLot.costBasis, // Use checked variable
        proceedsUsd: firstSelectedLot.proceeds, // Use checked variable
        gainUsd: firstSelectedLot.realizedGain // Use checked variable
      })
    });
    expect(mockDb.lot.update).toHaveBeenCalledTimes(1);
    expect(mockDb.lot.update).toHaveBeenCalledWith({
      where: { id: 'lot1' }, 
      data: expect.objectContaining({ 
        remainingQty: 0.5,
        closedAt: null
      })
    });
  });

  it('should throw BadRequestError for SELL with insufficient lots', async () => {
    const timestamp = new Date();
    const sellPayload = { timestamp: timestamp, type: 'sell', amount: 1.5, price: 60000 }; // Selling more than available
    const encryptedData = 'encrypted-sell-fail';
    const body = { timestamp: timestamp.toISOString(), encryptedData };
    mockEncryption.decryptString.mockResolvedValue(JSON.stringify(sellPayload));

    const mockCreatedTx = { id: 'tx-sell-fail', timestamp: timestamp, amount: 1.5, price: 60000, type: 'sell' };
    mockDb.bitcoinTransaction.create.mockResolvedValue(mockCreatedTx);

    const mockOpenLots = [{ id: 'lot1', openedAt: new Date(), originalAmount: 1, remainingQty: 1, costBasisUsd: 50000 }]; // Only 1 BTC available
    mockDb.lot.findMany.mockResolvedValue(mockOpenLots);

    const errorMessage = "Insufficient available lots for sale";
    mockCostBasis.selectLotsForSale.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(processTransaction(body, MOCK_SESSION))
      .rejects.toThrow(new BadRequestError(errorMessage));
    
    expect(mockDb.bitcoinTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockDb.lot.findMany).toHaveBeenCalledTimes(1);
    expect(mockCostBasis.selectLotsForSale).toHaveBeenCalledTimes(1);
    expect(mockDb.$transaction).not.toHaveBeenCalled(); // Ensure transaction block was not reached
    expect(mockDb.allocation.create).not.toHaveBeenCalled();
    expect(mockDb.lot.update).not.toHaveBeenCalled();
  });

}); 