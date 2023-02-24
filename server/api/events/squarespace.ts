import eventSourcesJSON from 'public/event_sources.json';
import { logTimeElapsedSince, serverCacheMaxAgeSeconds, serverStaleWhileInvalidateSeconds, serverFetchHeaders } from '~~/utils/util';

export default defineCachedEventHandler(async (event) => {
	const startTime = new Date();
	const body = await fetchSquarespaceEvents();
	logTimeElapsedSince(startTime, 'Squarespace: events fetched.');
	return {
		body
	}
}, {
	maxAge: serverCacheMaxAgeSeconds,
	staleMaxAge: serverStaleWhileInvalidateSeconds,
	swr: true,
});

async function fetchSquarespaceEvents() {
	console.log('Fetching Squarespace events...')
	let squarespaceSources = await useStorage().getItem('squarespaceSources');
	try {
		squarespaceSources = await Promise.all(
			eventSourcesJSON.squarespace.map(async (source) => {
				// Add current date in milliseconds to the URL to get events starting from this moment.
				let squarespaceJson = await (await fetch(source.url, { headers: serverFetchHeaders })).json();
				let squarespaceEvents = squarespaceJson.upcoming || squarespaceJson.items;
				return {
					events: squarespaceEvents.map(event => convertSquarespaceEventToFullCalendarEvent(event, source.url)),
					city: source.city
				} as EventNormalSource;
			})
		);
		await useStorage().setItem('squarespaceSources', squarespaceSources);
	} catch (e) {
		console.log('Error fetching Squarespace events: ', e);
	}
	return squarespaceSources;
};

function convertSquarespaceEventToFullCalendarEvent(e, url) {
	return {
		title: e.title,
		start: new Date(e.startDate),
		end: new Date(e.endDate),
		url: new URL(url).origin + e.fullUrl,
		extendedProps: {
			description: e.body,
			image: e.assetUrl,
			location: {
				geoJSON: {
					type: "Point",
					coordinates: [e.location.mapLng, e.location.mapLat]
				},
				eventVenue: {
					name: e.location.addressTitle,
					address: {
						streetAddress: e.location.addressLine1,
						// TODO: Some of these are not provided.
						//                        addressLocality: e.location.addressLine2.split(',')[0].trim(),
						//                        addressRegion: e.location.addressLine2.split(',')[1].trim(),
						//                        postalCode: e.location.addressLine2.split(',')[2].trim(),
						addressCountry: e.location.addressCountry
					},
					geo: {
						latitude: e.location.mapLat,
						longitude: e.location.mapLng,
					}
				},
			},
			raw: e
		}
	};
}
