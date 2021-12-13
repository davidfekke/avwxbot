
//import dotenv from 'dotenv';
import Fastify from 'fastify';
import POV from "point-of-view"
import { Liquid } from "liquidjs"
import path from "path"
import axios from 'axios';
import Particle from 'particle-api-js';

//dotenv.config();

const access_token = process.env.particle_access_token;
const device = process.env.button_device;
const airport = process.env.airport;
const vfrColor = [0,255,0];
const mvfrColor = [0,0,255];
const ifrColor = [255,0,0];
const lifrColor = [255,0,255];

let currentColor = 'green';
let flight_category = 'VFR';

const particle = new Particle();

const fastify = Fastify({
    logger: true
});
const __dirname = path.resolve(path.dirname(""))

const engine = new Liquid({
    root: path.join(__dirname, "views"),
    extname: ".liquid",
});

fastify.register(POV, {
    engine: {
        liquid: engine,
    }
});

// Declare a route
fastify.get("/", (request, response) => {
    response.view("./views/index.liquid", { currentweather: flight_category, color: currentColor });
});

fastify.get('/setcolor/:color', (request, reply) => {
    const color = request.params.color;
    console.log(`Setting color to ${color}`);
    currentColor = color;
    const publishEventPr = particle.publishEvent({ name: 'pushcolor', data: color, isPrivate: true, auth: access_token }); // isPrivate: true,
    publishEventPr.then(
        function(data) {
            if (data.body.ok) { console.log("Event published succesfully") }
        },
        function(err) {
            console.log("Failed to publish event: " + err)
        }
    );
    reply.send({ color: color });
});

fastify.get('/rainbow', (request, reply) => {
    const color = request.params.color;
    console.log(`Setting color to ${color}`);
    currentColor = color;
    const publishEventPr = particle.publishEvent({ name: 'pushcolor', data: '', isPrivate: true, auth: access_token }); // isPrivate: true,
    publishEventPr.then(
        function(data) {
            if (data.body.ok) { console.log("Event published succesfully") }
        },
        function(err) {
            console.log("Failed to publish event: " + err)
        }
    );
    reply.send({ color: color });
});

fastify.get('/reloadwx', (request, reply) => {
    sendCurrentWX();
    reply.send({ color: color });
});

// Run the server!
fastify.listen(3000, '0.0.0.0', function (err, address) {
    if (err) {
        //fastify.log.error(err)
        process.exit(1)
    }
// Server is now listening on ${address}
});


setImmediate(particleServiceTimer);
var timerId = setInterval(particleServiceTimer, 15 * 60 * 1000);

function getWeatherColor(wxFlyingRules) {
    if (wxFlyingRules === 'VFR') {
        currentColor = 'green';
        return vfrColor;
    } else if (wxFlyingRules === 'MVFR') {
        currentColor = 'blue';
        return mvfrColor;
    } else if (wxFlyingRules === 'LIFR') {
        currentColor = 'pink';
        return lifrColor;
    } else { // if IFR
        currentColor = 'red';
        return ifrColor;
    }
}

function colorForWeather(wxFlyingRules) {
    let weatherColor = getWeatherColor(wxFlyingRules);
    console.log('colorForWeather called');
    console.log(`Weather color is ${weatherColor}`);
    const publishEventPr = particle.publishEvent({ name: 'pushcolor', data: weatherColor.join(','), isPrivate: true, auth: access_token }); // isPrivate: true,
    publishEventPr.then(
        function(data) {
            if (data.body.ok) { console.log("Event published succesfully") }
        },
        function(err) {
            console.log("Failed to publish event: " + err)
        }
    );
}

particle.getEventStream({ deviceId: device, auth: access_token}).then(function(stream) {
    stream.on('event', function(data) {
        if (data.name === 'readyforwx') {
            console.log("Calling function sendCurrentWX(): ", data);
            sendCurrentWX();    
        }
    });
}).catch(function(err) {
    console.error(err); 
});

function particleServiceTimer() {
    sendCurrentWX();
}

async function sendCurrentWX() {
    console.log('Sending to Particle service.');
    const wxresult = await axios.get(`https://avwxproxy.herokuapp.com/metar/${airport}`);
    const jsonObj = wxresult.data;
    if (jsonObj.length > 0) {
        const metar = jsonObj[0];
        const flight_category = metar.flight_category;
        colorForWeather(flight_category);
    }
    getWeatherColor(flight_category);
    return currentColor; 
}
