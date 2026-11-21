// усе, що приходить на myyl-api.pages.dev, віддаємо основному серверу
export default { fetch: (req, env) => env.API.fetch(req) };
