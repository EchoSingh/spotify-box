require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');
const { Octokit } = require("@octokit/rest");

const {
    CLIENT_ID: client_id,
    CLIENT_SECRET: client_secret,
    REFRESH_TOKEN: refresh_token,
    TYPE: type,
    GIST_ID: gistId,
    GH_TOKEN: githubToken,
    TIME_RANGE: time_range
} = process.env;

const octokit = new Octokit({
    auth: `token ${githubToken}`
});

const spotifyApi = new SpotifyWebApi({
    clientId: client_id,
    clientSecret: client_secret,
    refreshToken: refresh_token
});

function truncate(str, n) {
    return (str.length > n) ? str.substr(0, n - 1) + '…' : str;
}

async function updateGist(content, description) {
    let gist;
    try {
        gist = await octokit.gists.get({ gist_id: gistId });
    } catch (error) {
        console.error(`Unable to get gist\n${error}`);
        return;
    }

    const oldFilename = Object.keys(gist.data.files)[0];
    const newFilename = oldFilename.endsWith('.md') ? oldFilename : `${oldFilename.split('.').shift()}.md`;


    try {
        await octokit.gists.update({
            gist_id: gistId,
            description: `🎧 Spotify | ${description}`,
            files: {
                [oldFilename]: {
                    filename: newFilename,
                    content: content
                }
            }
        });
    } catch (error) {
        console.error(`Unable to update gist\n${error}`);
    }
}

async function getTopTracks() {
    try {
        const topTracks = await spotifyApi.getMyTopTracks({ time_range: time_range, limit: 5 });
        const lines = topTracks.body.items.map(track => {
            const artist = track.artists[0].name;
            return `▶ ${truncate(track.name + " ", 35).padEnd(35, '.')} 🎵 ${truncate(artist + " ", 16)}`;
        });
        return lines.join("\n");
    } catch (error) {
        console.log('Error getting top tracks:', error);
        return '';
    }
}

async function getTopArtists() {
    try {
        const topArtists = await spotifyApi.getMyTopArtists({ time_range: time_range, limit: 5 });
        const lines = topArtists.body.items.map(artist => {
            const genres = artist.genres.slice(0, 2).join(", ");
            return `▶ ${truncate(artist.name + " ", 15).padEnd(15, '.')} 💽 ${truncate(genres + " ", 40)}`;
        });
        return lines.join("\n");
    } catch (error) {
        console.log('Error getting top artists:', error);
        return '';
    }
}

async function getRecentlyPlayed() {
    try {
        const recentlyPlayed = await spotifyApi.getMyRecentlyPlayedTracks({ limit: 20 }); // Fetch more to find unique ones
        const uniqueTracks = [];
        const trackIds = new Set();

        for (const item of recentlyPlayed.body.items) {
            if (!trackIds.has(item.track.id)) {
                trackIds.add(item.track.id);
                uniqueTracks.push(item);
            }
            if (uniqueTracks.length >= 2) {
                break;
            }
        }

        const lines = uniqueTracks.slice(0, 2).map(play => {
            const track = play.track;
            const artists = track.artists.map(artist => artist.name).join(', ');
            const album = track.album.name;
            const popularity = track.popularity; // number from 0 to 100

            // Let's create a simple popularity bar
            const popularityBar = '█'.repeat(Math.round(popularity / 10)) + '░'.repeat(10 - Math.round(popularity / 10));

            return `🎵 ${truncate(track.name, 30)}\n   - Artist(s): ${truncate(artists, 40)}\n   - Album: ${truncate(album, 30)}\n   - Popularity: ${popularityBar}`;
        });
        return lines.join("\n\n");
    } catch (error) {
        console.log('Error getting recently played tracks:', error);
        return '';
    }
}

async function main() {
    try {
        const accessToken = await spotifyApi.refreshAccessToken();
        spotifyApi.setAccessToken(accessToken.body['access_token']);

        let res;
        let des;

        if (type === 'combined') {
            const [recent, artists] = await Promise.all([
                getRecentlyPlayed(),
                getTopArtists()
            ]);
            res = `🎧 Recently Played:\n${recent}\n\n🌟 Top Artists:\n${artists}`;
            des = "Recent & Top Artists";
        } else if (type === 'recently_played') {
            res = await getRecentlyPlayed();
            des = "Recently Played";
        } else if (type === 'top_tracks') {
            res = await getTopTracks();
            des = "My Top Tracks";
        } else {
            res = await getTopArtists();
            des = "My Top Artists";
        }

        console.log(res);
        await updateGist(res, des);
    } catch (error) {
        console.log('Something went wrong in main():', error);
    }
}

(async () => {
    await main();
})();
