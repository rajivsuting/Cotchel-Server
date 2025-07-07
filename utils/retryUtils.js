const axios = require("axios");

const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let retries = 0;
  let delay = initialDelay;

  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
};

const retryAxiosRequest = async (config, maxRetries = 3) => {
  return retryWithBackoff(async () => {
    const response = await axios(config);
    return response.data;
  }, maxRetries);
};

module.exports = {
  retryWithBackoff,
  retryAxiosRequest,
};
