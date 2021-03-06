'use strict';

/*
    var field = {
        location: [12, 12],
        radius: 20,
        spread: 15,
        type: 'seek' // or 'avoid' or 'tangent'
    }
*/

function sq(x) { return x*x; }
function addArrays(a, b) {
    return a.map(function(n, i) {
        return n + b[i];
    });
}
function sign(n) { return (n >= 0) ? 1 : -1; }
function distance(l1, l2) {
    return Math.sqrt(sq(l1[0] - l2[0]) + sq(l1[1] - l2[1]));
}
function angle(l1, l2) {
    return Math.atan2(l2[1] - l1[1], l2[0] - l1[0]);
}

var insideReachAlpha = 0.2;
var outsideReachAlpha = 0.12;
var fieldFunction = {
    seek: function(location, goal) {
        var d = distance(location, goal.location);
        if (d < goal.radius) return [0, 0];

        var strength = goal.strength || 1;

        var reach = goal.radius + goal.spread,
            theta = angle(location, goal.location);

        if (d <= reach) {
            return [
                insideReachAlpha * (d-goal.radius) * Math.cos(theta) * strength,
                insideReachAlpha * (d-goal.radius) * Math.sin(theta) * strength
            ];
        } else {
            return [
                (outsideReachAlpha * goal.spread * Math.cos(theta))/Math.pow((d/reach), 1.2) * strength,
                (outsideReachAlpha * goal.spread * Math.sin(theta))/Math.pow((d/reach), 1.2) * strength
            ];
        }
    },

    avoid: function(location, obstacle) {
        var d = distance(location, obstacle.location),
            theta = angle(location, obstacle.location);


        if (d < obstacle.radius)
            return [
                -1 * sign(Math.cos(theta)) * obstacle.spread,
                -1 * sign(Math.sin(theta)) * obstacle.spread
            ];

        var reach = obstacle.radius + obstacle.spread;

        if (d <= reach) {
            return [
                -1 * 0.4321 * (reach - d) * Math.cos(theta),
                -1 * 0.4321 * (reach - d) * Math.sin(theta)
            ];
        } else {
            return [0, 0];
        }
    },

    tangent: function(location, field) {
        var xy = fieldFunction.avoid(location, field),
            origin = [0,0],
            a = angle(xy, origin),
            m = distance(xy, origin),
            newA = normalizeAngle(a + Math.PI / 2),
            newx = Math.cos(newA) * m,
            newy = Math.sin(newA) * m;
        return [newx, newy];
    }
};

function gradient(location, fields) {
    return fields.reduce(function(g, field) {
        var _g = fieldFunction[field.type](location, field);
        return addArrays(g, _g);
    }, [0, 0]);
}

// Take any angle and return angle between +pi, -pi
function normalizeAngle(angle) {
    while(angle > Math.PI) {
        angle = angle - 2 * Math.PI;
    }
    while(angle < -Math.PI) {
        angle = angle + 2 * Math.PI;
    }
    return angle;
}

function pdController(yt, xt, prev_yt, prev_xt, timeChange, Kp, Kd, differenceFunction) {
    Kp = Kp || 0.1;
    Kd = Kd || 0.1;
    if(differenceFunction === undefined) {
        differenceFunction = function(a, b) { return normalizeAngle(a - b); };
    }

    var p = Kp * differenceFunction(yt, xt);
    if(prev_yt === undefined || prev_xt === undefined || timeChange === undefined) {
        return p;
    } else {
        return p + Kd * (differenceFunction(yt, xt) - differenceFunction(prev_yt, prev_xt))/timeChange;
    }
}

function pdControllerError(currentError, lastError, timeChange, Kp, Kd) {
    Kp = Kp || 0.1;
    Kd = Kd || 0.1;
    var pd = Kp * currentError + Kd * lastError / timeChange;
    return pd;
}

/*
 * Generate a list of field objects whose path cover the
 * entire map with a given observation size (occSize).
 */
function generateCoveringFields(mapSize, occSize) {
    //console.log("Generating fields for mapSize: " + mapSize + " and occSize: " + occSize);
    var topY = mapSize / 2 - occSize / 2;
    var bottomY = -mapSize / 2 + occSize / 2;

    var currentX = -mapSize / 2 + occSize / 2;

    var fields = [];
    var atTop = true;
    var shouldInc = false;
    while(currentX <= mapSize / 2 - occSize / 2) {
        //console.log([currentX, atTop, shouldInc]);
        fields.push({
            location: [currentX, atTop ? topY : bottomY],
            radius: 1,
            spread: 100,
            type: 'seek'
        });
        if(atTop) {
            atTop = false;
        } else {
            atTop = true;
        }
        if(shouldInc) {
            shouldInc = false;
            currentX += occSize;
        } else {
            shouldInc = true;
        }
    }
    return fields;
}

module.exports = {
    normalizeAngle: normalizeAngle,
    pdController: pdController,
    pdControllerError: pdControllerError,
    gradient: gradient,
    distance: distance,
    angle: angle,
    generateCoveringFields: generateCoveringFields
};
