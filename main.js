var strava = require('strava-v3');
var express = require('express');
var path = require('path');
var app = express();
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var fs = require("fs");
var qpm = require('query-params-mongo');
var mongodb = require('mongodb');

var all_activities = [];


app.use(express.static(path.join(__dirname, 'public')));


function get_all_activities(callback) {
	console.log("get_all_activities");
	if (all_activities.length > 0) {
		console.log("" + all_activities.length + " activities cached");
		callback(all_activities);
	}
	else {
		console.log("fetching...");
		_fetchpage(1, all_activities, callback);
	}
}

function _fetchpage(page_num, d, cb_end) {
	console.log("fetching page " + page_num);
	strava.athlete.listActivities({'page':page_num, 'per_page':200}, function(err, payload) {
		if (err || payload == undefined || payload.length == 0) {
			console.log("error or end");
			console.log(err);
			cb_end(d);
		} else {
			var d1 = d.concat(payload);
			_fetchpage(page_num + 1, d1, cb_end);
		}
	});
}

app.get('/activities', function(req, res) {
	res.setHeader('Content-Type', 'application/json');
	get_all_activities(function(d) { 
		res.send(d);
	});
});

app.get('/activities_map', function(req, res) {
    res.render('map.ejs');
});

app.get('/searchws', function(req, res) {

	//console.log("******* search0: req.query=");
	//console.log(req.query);

	var q = { "name": { $regex: req.query['keyword'], $options: 'i' } };		

    mongodb.MongoClient.connect('mongodb://localhost/stravasearch', function(err, db) {
    	if(err) {
    		console.log(err);
        	res.status(500).send(err);
        } else {
        	res.setHeader('Content-Type', 'application/json');
        	db.collection('activities').find(q).toArray(function (err, results) {
        		if (err) {
        			console.log(err)
        			res.status(500).send(err);
        		} else {
        			//console.log("******* search0: " + results.length + " result(s)");
        			res.send(results);
        		}
  			});
        }
    });

});

app.get('/search', function(req, res) {
	res.sendFile(path.join(__dirname + '/public/search.html'));
});


app.listen(8080);