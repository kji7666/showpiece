const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 模擬付款處理
export const processPayment = async (paymentData) => {
  console.log('正在連接支付閘道...', paymentData);
  await delay(2000); // 模擬網路延遲 2秒

  // 簡單的驗證模擬
  if (paymentData.cardNumber.length < 16) {
    throw new Error('信用卡號碼無效');
  }

  return {
    success: true,
    transactionId: 'tx_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString()
  };
};