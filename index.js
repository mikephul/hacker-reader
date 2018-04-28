'use strict';

const functions = require('firebase-functions');
const { dialogflow } = require('actions-on-google');
const { Image, Suggestions, LinkOutSuggestion, BrowseCarousel, BrowseCarouselItem } = require('actions-on-google');
const rp = require('request-promise');
const ta = require('time-ago');

const app = dialogflow();

app.intent('random', (conv, {num_random}) => {
    console.log('get random ' + num_random);
    var hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    var num_display = checkScreenAndNum(hasScreen, num_random) 
    conv.ask("Here are your " + num_display + " random stories for today:");
    var options = {
        uri: 'https://hacker-news.firebaseio.com/v0/topstories.json',
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true 
    };
    
    return rp(options)
        .then(randomStories => getRandom(randomStories, num_display).map(getStoryDetail))
        .then(p => Promise.all(p))
        .then(detail => showCardOrSpeak(detail, conv))
        .catch(p => console.log("error: " + p));
});

app.intent('best_stories', (conv, {num_best}) => {
    console.log('get best ' + num_best);
    var hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    var num_display = checkScreenAndNum(hasScreen, num_best) 
    conv.ask("Here are your " + num_display + " best stories for today:");
    var options = {
        uri: 'https://hacker-news.firebaseio.com/v0/beststories.json',
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true 
    };
    
    return rp(options)
        .then(bestStories => bestStories.slice(0, num_display).map(getStoryDetail))
        .then(p => Promise.all(p))
        .then(detail => showCardOrSpeak(detail, conv))
        .catch(p => console.log("error: " + p));
});

app.intent('top_stories', (conv, {num_top}) => {
    console.log('get top ' + num_top);
    var hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    var num_display = checkScreenAndNum(hasScreen, num_top)  
    conv.ask("Here are your top " + num_display + " stories for today:");
    var options = {
        uri: 'https://hacker-news.firebaseio.com/v0/topstories.json',
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true 
    };
    
    return rp(options)
        .then(topStories => topStories.slice(0, num_display).map(getStoryDetail))
        .then(p => Promise.all(p))
        .then(detail => showCardOrSpeak(detail, conv))
        .catch(p => console.log("error: " + p));
});

app.intent('new_stories', (conv, {num_new}) => {
    console.log('get new ' + num_new);
    var hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    var num_display = checkScreenAndNum(hasScreen, num_new)   
    conv.ask("Here are your " + num_display + " new stories for today:");
    var options = {
        uri: 'https://hacker-news.firebaseio.com/v0/newstories.json',
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true 
    };
    
    return rp(options)
        .then(newStories => newStories.slice(0, num_display).map(getStoryDetail))
        .then(p => Promise.all(p))
        .then(detail => showCardOrSpeak(detail, conv))
        .catch(p => console.log("error: " + p));
});

app.intent('Default Welcome Intent', conv => {
    conv.ask('Hello world! Welcome to Hacker Reader. Ask me for top, new, best or random stories from Hacker News. What do you like to hear?');
    var hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    if (hasScreen) {
        conv.ask(new Suggestions(['top 🕶', 'new 🔥', 'best 🎉', 'random 👾']));
        conv.ask(new LinkOutSuggestion({
          name: 'web',
          url: 'https://news.ycombinator.com/',
        }));
    }
});

// Return SSML or BrowseCarousel according to the device type
// (no screen or has screen)
function showCardOrSpeak (detail, conv) {
    var hasScreen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');        
    if (hasScreen) {
        var cards = [];
        for(var i = 0; i < detail.length; i++) {
            var d = new Date(0); 
            d.setUTCSeconds(detail[i].time);
            var desc = detail[i].score + ' points by ' + detail[i].by + ' ' + ta.ago(d);
            desc += ' | ';
            desc += detail[i].descendants + ' comments';
            var link = detail[i].url;
            if (link === undefined) {
                link = "https://assistant.google.com";
            }
            cards.push(new BrowseCarouselItem({
              title: detail[i].title,
              url: link,
              description: desc,
            }));
        }
        conv.ask(new BrowseCarousel({items: cards}));
        conv.ask(new Suggestions(['top 🕶', 'new 🔥', 'best 🎉', 'random 👾']));
        conv.ask(new LinkOutSuggestion({
          name: 'web',
          url: 'https://news.ycombinator.com/',
        }));
    } else {
        let ssml = "<speak><p>";
        for(var i = 0; i < detail.length; i++) {
            ssml += '<s><say-as interpret-as="ordinal">' + (i+1) + '</say-as>.<break time="0.6s"/>' + detail[i].title + '.</s><break time="0.5s"/>';
        }
        ssml += "<s>What else I can help?</s></p></speak>";
        conv.ask(ssml);
    }
    return;
}

// Validate number of stories user ask for
function checkScreenAndNum(hasScreen, num_ask) {
    var num_display;    
    if (hasScreen && num_ask <= 2) {
        num_display = 2;
    } else if (hasScreen && num_ask > 10) {
        num_display = 10;
    } else if (!hasScreen && num_ask <= 0) {
        num_display = 1;
    } else if (!hasScreen && num_ask > 20) {
        num_display = 20;
    } 
    return num_display;
}

// Get story detail from Hacker News API
function getStoryDetail(story_id) {
    var options = {
        uri: 'https://hacker-news.firebaseio.com/v0/item/' + story_id + '.json',
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true
    };
    return Promise.resolve(rp(options).then(function (j) {
        var data = {};
        data.title = j.title;
        data.url = j.url;
        data.score = j.score;
        data.by = j.by;
        data.time = j.time;
        data.descendants = j.descendants;
        return data;
    }));
}

// Get n random elements from array
// https://stackoverflow.com/questions/19269545/how-to-get-n-no-elements-randomly-from-an-array
function getRandom(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len)
        throw new RangeError("getRandom: more elements taken than available");
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}
    
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);