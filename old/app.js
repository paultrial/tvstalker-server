var express = require('express'),
    app = express(),
    sendRequest = require('send-http-request'),
    xmlparse = require('xml2js').parseString,
    MongoClient = require('mongodb').MongoClient,
    bodyParser = require('body-parser'),
    bcrypt = require('bcrypt-nodejs'),
    crypto = require('crypto'),
    schedule = require('node-schedule'),
    async = require('async'),
    subs = require('opensubtitles-client').api,
    cookieParser = require('cookie-parser'),
    favicon = require('serve-favicon');

app.use(bodyParser());
app.use(cookieParser());
app.set('view engine', 'ejs');

MongoClient.connect('mongodb://127.0.0.1:27017/Series', function (err, db) {
    'use strict';
    if (err) throw err;

    var tvMazeFull = db.collection('tvMazeFull');
    var users = db.collection('users');
    var sessions = db.collection('sessions');
    var flSeries = db.collection('flSeries');
    var rarBgSeries = db.collection('rarBgSeries');

    app.post('/serieDB', function (req, res) {
        var qstring = new RegExp(req.body.query, 'i'), query, projection;

        switch (typeof (req.body.country)) {
            case 'undefined': query = { name: { $regex: qstring } }; projection = { _id: 0 };
                break;
            case 'string': query = { name: { $regex: qstring }, country: req.body.country }; projection = { _id: 0 };
                break;
        }

        tvMazeFull.find(query, projection).sort({ name: 1 }).toArray(function (err, items) {
            if (err) throw err;
            res.send(items);
        });
    });

    app.get('/popularWatched', function (req, res) {
        var arr, aee;
        users.aggregate(
            { $unwind: '$favorites' },
            { $group: { _id: '$favorites', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            function (err, items) {
                if (err) throw err;

                arr = items.map(function (e) { return { id: e._id }; });
                aee = items.map(function (e) { return { id: e._id, count: e.count }; });

                var query = { $and: [{ $or: arr }] };

                tvMazeFull.find(query).toArray(function (err, data) {
                    if (err) throw err;

                    var response = [];

                    aee.forEach(function (elem) {
                        data.forEach(function (el) {
                            if (elem.id == el.id) {
                                el.count = elem.count;
                                response.push(el);
                            }
                        });
                    });
                    res.send(response);
                });
            });
    });

    app.post('/moreInfo', function (req, res) {
        tvMazeFull.findOne({ id: +req.body.showid }, function (err, data) {
            res.send(data);
        })
    });

    app.post('/GetFlForSerie', function (req, res) {
        var qstring = new RegExp("^" + req.body.serie.replace(":", ""), 'i');
        var query = { title: { $regex: qstring } }, projection = { _id: 0 };

        flSeries.find(query, projection).limit(100).sort({ time: -1 }).toArray(function (err, items) {
            if (err) throw err;
            res.send(items);
        });
    });

    app.post('/GetRARBGForSerie', function (req, res) {
        var qstring = new RegExp("^" + req.body.serie.replace(":", ""), 'i');
        var query = { title: { $regex: qstring } }, projection = { _id: 0 };

        rarBgSeries.find(query, projection).limit(100).sort({ time: -1 }).toArray(function (err, items) {
            if (err) throw err;
            res.send(items);
        });
    });

    app.post('/subtitles', function (req, res) {
        subs.login().then(function (token) {
            subs.searchForTitle(token, 'rum', req.body.name).then(function (results) {
                subs.logout(token);
                res.send(results);
            });
        });
    });

    app.post('/logIn', function (req, res) {
        var username = req.body.username;
        var password = req.body.password;

        users.findOne({ username: username }, function (err, user) {
            if (!!user) {
                if (bcrypt.compareSync(password, user.password)) {
                    var current_date = (new Date()).valueOf().toString();
                    var random = Math.random().toString();
                    var session_id = crypto.createHash('sha1').update(current_date + random).digest('hex');

                    var session = { 'username': username, '_id': session_id };

                    sessions.insert(session, function (err) {
                        if (err) { throw err; }
                        res.cookie('session', session_id, { expires: new Date(Date.now() + 1209600000) });

                        res.send(true);
                    });
                } else {
                    res.send(false);
                }
            } else {
                res.send(false);
            }
        });
    });

    app.post('/signUp', function (req, res) {
        var username = req.body.username;
        var password = req.body.password;
        var FLpasskey = req.body.FLpasskey;
        var email = req.body.email;

        var salt = bcrypt.genSaltSync();
        var password_hash = bcrypt.hashSync(password, salt);

        var user = { username: username, password: password_hash, FLpasskey: FLpasskey, email: email, favorites: [] };

        users.find({ username: username, email: email }).toArray(function (err, items) {
            if (err) throw err;
            if (items.length === 0) {
                users.insert(user, function (err) {
                    if (err) { throw err; }
                    res.send(true);
                });
            } else {
                res.send(false);
            }
        });
    });

    app.post('/passRecover', function (req, res) {
        var email = req.body.email;

        users.findOne({ email: email }, function (err, data) {
            if (err) {
                throw err;
            } else {
                if (data) {
                    data.token = giveGUID();
                    var recoverlink = "https://tvstalker.rosoftlab.net/#/passReplace/" + data.token + "/" + data.email;
                    // send mail and return a message to post it to the page -- so that the user knows the email was sent.
                    var htmlString = [];
                    htmlString.push("Hello " + data.username + "!<br>");
                    htmlString.push("If you haven't requested this email please ignore it and/or delete it. <br>");
                    htmlString.push("To change the password access this link: <a href='" + recoverlink + "'target='_blank'> " + recoverlink + " </a> <br>");
                    htmlString.push("You can use this link only once.");

                    transporter.sendMail({
                        from: "passRecovery@tvstalker.rosoftlab.net",
                        to: email,
                        subject: "TV Stalker Recovery Password",
                        html: htmlString.join("")
                    });

                    res.send(true);
                    users.update({ email: email }, { $set: { token: data.token } }, function (err, response) {
                        if (err) {
                            throw err;
                        }
                    });
                } else {
                    res.send(false);
                }
            }

        })
    });

    app.post('/newPass', function (req, res) {
        var token = req.body.guid, email = req.body.email, password = req.body.password;
        var salt = bcrypt.genSaltSync();
        var password_hash = bcrypt.hashSync(password, salt);

        users.update({ email: email, token: token }, { $set: { password: password_hash } }, function (err, data) {
            if (err) {
                throw err;
            } else if (data) {
                res.send(true);
            } else {
                res.send(false);
            }
        });
        users.update({ email: email, token: token }, { $set: { token: "" } }, function (err, data) {
            if (err) {
                throw err;
            }
        });
    });

    app.post('/passReplace', function (req, res) {
        var token = req.body.guid, email = req.body.email;

        users.findOne({ email: email, token: token }, function (err, data) {
            if (err) {
                throw err;
            } else if (data) {
                res.send(true);
            } else {
                res.send(false);
            }
        });
    });

    app.post("/newPasskey", function (req, res) {
        var usr = req.body.user;
        var newPasskey = req.body.passKey;
        var password = req.body.password;

        users.findOne({ username: usr.username }, function (err, user) {
            if (err) {
                throw err;
            } else {
                if (!!user) {
                    if (bcrypt.compareSync(password, user.password)) {
                        users.update({ username: user.username }, { $set: { FLpasskey: newPasskey } }, function (err, data) {
                            if (err) {
                                throw err;
                            } else {
                                users.findOne({ username: user.username }, function (err, user) {
                                    res.send({ newPasskey: user.FLpasskey });
                                });
                            }
                        });
                    } else {
                        // not a good password;
                        res.send(false);
                    }
                } else {
                    res.send(false);
                }
            }
        });
    });

    app.get('/user', function (req, res) {
        if (typeof (req.cookies.session) == 'undefined') {
            res.send({ user: undefined });
        } else {
            sessions.findOne({ '_id': req.cookies.session }, function (err, user) {
                if (err) throw err;
                if (!user) {
                    res.redirect('/#/login');
                } else {
                    req.cookies.session = ({ expires: new Date(Date.now() + 1209600000) });
                    var query = { username: user.username };
                    var projection = { '_id': 0, 'password': 0 };
                    users.findOne(query, projection, function (err, data) {
                        if (err) throw err;
                        res.send(data);
                    });
                }
            });
        }
    });

    app.get('/logout', function (req, res) {
        res.cookie('session', '');
        res.send(true);
    });

    setInterval(function () {
        rBG();
    }, 360000);

    rBG();

    function rBG() {
        var rarbg = sendRequest('GET', 'https://eztvx.to/ezrss.xml');
        rarbg.then(function (response) {
            xmlparse(response.text, function (err, result) {
                result = result.rss.channel[0].item;
                async.each(result, function (item) {
                    var rarBGtitle = item.title[0].split('.').join(' ');
                    var rarBGlink = item.link[0];
                    // var rarBGDesc = item.description[0];
                    var rarBGpubDate = item.pubDate[0];
                    // if (rarBGtitle.indexOf('720p') > -1 || rarBGtitle.indexOf('1080p') > -1) {
                        var time = new Date(rarBGpubDate);
                        var obj = {
                            title: rarBGtitle,
                            webLink: rarBGlink,
                            // descr: rarBGDesc,
                            time: time.getTime()
                        };
                        rarBgSeries.find({ title: obj.title }).toArray(function (err, items) {
                            if (!items.length) {
                                console.log(obj.title);
                                rarBgSeries.insert(obj, function (err, message) {
                                    if (err) { throw err; }
                                    console.log(message);
                                });
                            }
                        });
                    // }
                }, function (err) {
                    if (err) {
                        throw err;
                    }
                    console.log('Complete! ');
                });
            });
        });
    }

    app.post('/seriesAddToSet', function (req, res) {
        sessions.findOne({ '_id': req.cookies.session }, function (err, user) {
            if (err) throw err;
            if (!user) {
                res.redirect('/#/login');
            } else {
                // goGetMoreInfo([req.body.id]);
                var query = { username: user.username };
                users.update(query, { $addToSet: { favorites: req.body.id } }, function (err, message) {
                    if (err) { throw err; }
                    res.send(!!message);
                });
            }
        });
    });

    app.post('/seriesPull', function (req, res) {
        sessions.findOne({ '_id': req.cookies.session }, function (err, user) {
            if (err) throw err;
            if (!user) {
                res.redirect('/#/login');
            } else {
                var query = { username: user.username };
                users.update(query, { $pull: { favorites: req.body.id } }, function (err, message) {
                    if (err) { throw err; }
                    res.send(!!message);
                });
            }
        });
    });

    app.post('/usersSeries', function (req, res) {
        var list = req.body.list;

        var mapped = [];
        list.forEach(function (e) {
            mapped.push({ id: e });
        });
        var query = { $and: [{ $or: mapped }] };

        sessions.findOne({ '_id': req.cookies.session }, function (err, user) {
            if (err) throw err;

            if (!user) {
                res.redirect('/#/login');
            } else {
                tvMazeFull.find(query).toArray(function (err, data) {
                    res.send(data);
                });
            }
        });
    });

    app.post('/usersSeriesMoreInfo', function (req, res) {
        var list = req.body.list;

        // goGetMoreInfo(list);
        var mapped = [];
        list.forEach(function (e) {
            mapped.push({ id: e });
        });
        var query = { $or: mapped };

        sessions.findOne({ '_id': req.cookies.session }, function (err, user) {
            if (err) throw err;
            if (!user) {
                res.redirect('/#/login');
            } else {
                tvMazeFull.find(query).toArray(function (err, data) {
                    res.send(data);
                });
            }
        });
    });

    app.get('/instaSearch/:q', function (req, res) {
        instagram.user_search(req.params.q, { count: 50 }, function (err, users) {
            res.send(users);
        });
    });

    // schedule.scheduleJob('0 3 * * *', function () {

    // });

    function flCeva() {
        var FLS = sendRequest('GET', 'https://filelist.io/rss.php?feed=dl&cat=21&passkey=7e823ade4f2aeecf036d643499bf954b');
        FLS.then(function (response) {
            xmlparse(response.text, function (err, result) {
                result = result.rss.channel[0].item;
                async.each(result, function (item) {
                    var FLtitle = item.title[0].split('.').join(' ');
                    var FLlink = item.link[0];
                    var FLDesc = item.description[0];
                    // if (FLtitle.indexOf('720p') > -1 || FLtitle.indexOf('1080p') > -1) {
                        var time = new Date();
                        var obj = {
                            title: FLtitle,
                            webLink: FLlink,
                            descr: FLDesc,
                            time: time.getTime()
                        };
                        flSeries.find({ title: obj.title }).toArray(function (err, items) {
                            if (err) return;
                            if (!items.length) {
                                flSeries.insert(obj, function (err, message) {
                                    if (err) { throw err; }
                                    console.log(message);
                                });
                            }
                        });
                    // }
                }, function (err) {
                    if (err) {
                        throw err;
                    }
                    console.log('Complete! ');
                });
            });
        });
    }

    setInterval(function () {
        flCeva();
    }, 360000);

    flCeva();

    app.post('/filelistSeries', function (req, res) {
        var query = { time: { $gt: req.body.time } };
        flSeries.find(query).toArray(function (err, items) {
            if (err) { throw err; }
            res.send(items);
        });
    });

    app.post('/rarbgseries', function (req, res) {
        var query = { time: { $gt: req.body.time } };
        rarBgSeries.find(query).toArray(function (err, items) {
            if (err) { throw err; }
            res.send(items);
        });
    });

    app.use(favicon(__dirname + '/public/favicon.ico'));

    app.set('port', (process.env.PORT || 8080));
    app.set('views', __dirname + '/views');

    app.get('/', function (req, res) {
        res.render('default');
    });

    app.use(express.static(__dirname + '/public'));

    app.listen(app.get('port'), function () {
        console.log('Node app is running at localhost:' + app.get('port'));
    });

    function giveGUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        })
    }

});

function createTvMazeCollection() {
    MongoClient.connect('mongodb://127.0.0.1:27017/Series', function (err, db) {
        'use strict';
        if (err) throw err;
        var tvMazeFull = db.collection('tvMazeFull');

        var page = 0;
        var allTVmazeShows = [];
        function getTVmazeShows(page) {
            sendRequest("GET", "https://api.tvmaze.com/shows?page=" + page).then(function (r) {
                var r = JSON.parse(r.text);
                if (r.length > 0) {
                    allTVmazeShows = allTVmazeShows.concat(r);
                    page += 1;
                    console.log(page, r.length, allTVmazeShows.length);
                    getTVmazeShows(page);
                } else {
                    tvMazeFull.remove({}, function (eroare, aMers) {
                        if (eroare) {
                            console.log(eroare);
                        } else {
                            var bigNumber = specSplit(allTVmazeShows, 8).length - 1;
                            var smallNumber = 0;
                            async.each(specSplit(allTVmazeShows, 8), function (arrToBeInserted, err) {
                                tvMazeFull.insert(arrToBeInserted, function (e, r) {
                                    if (e) throw e;
                                    console.log(e);
                                    console.log("inserted");
                                    smallNumber++;
                                    if (bigNumber < smallNumber) {
                                        db.close();
                                        return;
                                    }
                                });
                            });
                        }
                    });
                }
            });
        }
        getTVmazeShows(page);
        var specSplit = function (arr, nrSplits) {
            var splitsLength;
            if (arr % nrSplits === 0) {
                splitsLength = arr.length / nrSplits;
            } else {
                splitsLength = Math.ceil(arr.length / nrSplits);
            }

            var newArrays = [];

            for (var i = 0; i < nrSplits; i++) {
                // i
                var start = i * splitsLength;
                var end = (i * splitsLength) + splitsLength;
                newArrays.push(arr.slice(start, end));
            }

            return newArrays;
        }
    });
}

schedule.scheduleJob("00 3 * * 1", createTvMazeCollection);