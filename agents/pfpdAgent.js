var BZRClient = require('bzrflag-client');
var async = require('async');
var pf = require('../lib/potential-fields');


/**
 * Note: This is just a sample team where all of the tanks on a team
 * are controlled with simple directions
 * 1. if there is an enemy flag that is not picked up, go get it.
 * 2. if you have a flag go back to your base
 * 3. otherwise go attack the closest enemy
 *
 * It should be a good starting point to see how the client is used.
 *
 * To use it just run:
 *    node agent.js <port>
 */

function Team(client){
    this.client = client;
    this.myTanks = {};
    this.init();
}

Team.prototype.init = function() {
    var me = this;
    this.client.getConstants(function(constants){
        me.constants = constants;
    });
    this.client.getBases(function(bases){
        me.bases = bases;
    });
    this.client.getMyTanks(function(myTanks, time){
        myTanks.forEach(function(tank){
            me.myTanks[tank.index] = tank;
            me.myTanks[tank.index].lastVelError = 0;
            me.myTanks[tank.index].lastAngleError = 0;
            me.myTanks[tank.index].vx = 0;
            me.myTanks[tank.index].vy = 0;
            me.lastUpdated = time;
        });
    });
};

Team.prototype.update = function(done) {
    var me = this;
    var client = this.client;
    var callsToMake = 4;
    var dt = 0;
    function received(){
        callsToMake--;
        if(callsToMake === 0)
            done(dt);
    }
    client.getMyTanks(function(myTanks, time){
        dt = time-me.lastUpdated;
        myTanks.forEach(function(tank){
            var lastVelError = me.myTanks[tank.index].lastVelError;
            var lastAngleError = me.myTanks[tank.index].lastAngleError;
            me.myTanks[tank.index] = tank;
            me.myTanks[tank.index].lastVelError = lastVelError;
            me.myTanks[tank.index].lastAngleError = lastAngleError;
        });

        me.lastUpdated = time;
        received();
    });
    client.getOtherTanks(function(otherTanks){
        me.otherTanks = otherTanks;
        me.enemies = otherTanks.filter(function(tank){
            return tank.color != me.constants.team;
        });
        received();
    });
    client.getFlags(function(flags){
        me.flags = flags;
        received();
    });
    client.getShots(function(shots){
        me.shots = shots;
        received();
    });
};

Team.prototype.start = function() {
    var me = this;

    async.whilst(function() {return true;},
                 function(callback) {
                     async.series([
                         me.tick.bind(me),
                         function(callback) {setTimeout(callback, 10000);},
                     ],
                     callback);
                 });
};

Team.prototype.tick = function(callback) {
    var me = this;
    var origin = [0, 0];
    this.update(function(dt){
        console.log('World updated after ' + dt + ' milliseconds');
        if(dt === 0) {
            console.log('Zero dt, changing to small value');
            dt = 0.0001;
        }
        for(var tankIndex in me.myTanks) {
            console.log('Updating tank ' + tankIndex + ':');
            var tank = me.myTanks[tankIndex];
            var tankvxy = [tank.vx, tank.vy];
            var pfdxy = [0.23, 0.51];// from potential fields

            // velocity pd
            var goalVel = pf.distance(pfdxy, origin);
            console.log('\tgoalVel: ' + goalVel);
            var actualVel = pf.distance(tankvxy, origin);
            console.log('\tactualVel: ' + actualVel);
            var velError = goalVel - actualVel;
            console.log('\tvelError: ' + velError + '; lastVelError: ' + tank.lastVelError);
            var newVel = pf.pdControllerError(velError, tank.lastVelError, dt);
            console.log('\tnewVel: ' + newVel);
            tank.lastVelError = velError;
            me.client.speed(tankIndex, newVel);

            // angle pd
            var goalAngle = pf.angle(pfdxy, origin);
            var actualAngle = pf.angle(tankvxy, origin);
            var angleError = goalAngle - actualAngle;
            var newAngleVel = pf.pdControllerError(angleError, tank.lastAngleError, dt);
            tank.lastAngleError = angleError;
            me.client.angvel(tankIndex, newAngleVel);
        }
        callback();
    });
};


if(process.argv.length > 2){
    var port = process.argv[2];
    var team = new Team(new BZRClient(port));
    console.log('Starting');
    team.start();
}
