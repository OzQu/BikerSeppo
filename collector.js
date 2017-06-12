'use strict'

const strava = require('strava-v3');
const Slack = require("slack-node");
const moment = require('moment');
const _ = require('lodash');

const token = process.env.STRAVA_ACCESS_TOKEN;
const clubId = process.env.STRAVA_CLUB_ID;
const SlackWebhook = process.env.BIKER_SLACK_WEBHOOK;
const slackChannel = process.env.BIKER_SLACK_CHANNEL;
const botname = process.env.BIKER_BOTNAME;

const timeformat = 'YYYY-MM-DDTHH:mm:ss';

exports.handler = function(event, context, callback) {
    strava.clubs.listActivities(
        {
            'access_token': token, 
            'id': clubId,
        }, 
        function(err,payload,limits) {
            if(!err) {
                let processed = _.chain(payload)
                .filter( value => moment(value.start_date, timeformat).isAfter(moment().startOf('day')))
                .groupBy('athlete.id')
                .map(value => {
                    return {
                        'name': _.first(value).athlete.firstname + " " + _.first(value).athlete.lastname,
                        'distance': _.sumBy(value, 'distance')
                    };
                })
                .orderBy('distance', 'desc')
                .take(3)
                .reduce((text, value) => text.concat(value.name + " rode " + Math.round(value.distance/1000) + 'km today \n'), "Top3 on Strava today: \n")
                .value();

                console.log(processed);

                if (processed) {
                    let slack = new Slack();
                    slack.setWebhook(SlackWebhook);
                    slack.webhook({
                        text: processed.slice(0, -2),
                        channel: slackChannel,
                        username: botname
                    }, function(err, res) {
                        console.log(err, res);
                        callback(null, { message: 'success', event});
                    });
                } else {
                    callback(null, { message: 'success', event});
                }
            }
            else {
                console.log(err);
            }
        }
    );
};

