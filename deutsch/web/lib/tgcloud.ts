/** Mini App endpoint call. Telegram Serverless supplies its authenticated runtime. */
export async function callEndpoint<T>(name: string, input: unknown): Promise<T> {
  if (typeof window === "undefined") throw new Error("outside-telegram");
  const webApp = (window as Window & {
    Telegram?: {
      WebApp?: {
        initData?: string;
        Serverless?: { call: (endpoint: string, data: unknown, callback: (error: Error | null, result: unknown) => void) => void };
      };
    };
  }).Telegram?.WebApp;
  if (!webApp?.initData || !webApp.Serverless) throw new Error("outside-telegram");
  return new Promise<T>((resolve, reject) => {
    try {
      webApp.Serverless!.call(name, input, (error, result) => {
        if (error) reject(error);
        else resolve(result as T);
      });
    } catch (error) {
      reject(error);
    }
  });
}
