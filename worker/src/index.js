/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env) {
		if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

		const { messages } = await request.json();

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.OPENAI_API_KEY}`, // set in Worker secrets
			},
			body: JSON.stringify({
				model: 'gpt-4o',
				messages,
				max_tokens: 1000,
			}),
		});

		const data = await response.json();
		return new Response(JSON.stringify(data), {
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*', // tighten this in production
			},
		});
	},
};
