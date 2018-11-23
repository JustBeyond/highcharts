/**
 * (c) 2010-2018 Grzegorz Blachlinski, Sebastian Bochan
 *
 * License: www.highcharts.com/license
 */

'use strict';

import H from '../parts/Globals.js';
import '../parts/Utilities.js';
import '../parts/Axis.js';
import '../parts/Color.js';
import '../parts/Point.js';
import '../parts/Series.js';
import '../parts/ScatterSeries.js';

var seriesType = H.seriesType,
    each = H.each;


/**
 * A packed bubble series is a two dimensional series type, where each point
 * renders a value in X, Y position. Each point is drawn as a bubble
 * where the bubbles don't overlap with each other and the radius
 * of the bubble related to the value.
 * Requires `highcharts-more.js`.
 *
 * @extends plotOptions.bubble
 * @excluding minSize,maxSize,connectNulls,keys,sizeByAbsoluteValue,
 * step,zMin,zMax,sizeBy,connectEnds
 * @product highcharts
 * @sample {highcharts} highcharts/demo/packed-bubble/
 *         Packed-bubble chart
 * @since 7.0.0
 * @optionparent plotOptions.packedbubble
 */

seriesType('packedbubble', 'bubble',
    {
        /**
        * The minimum size of the points' radius related to chart's `plotArea`.
        * If a number is set, it applies in pixels.
        *
        * @sample {highcharts}
        *         highcharts/variable-radius-pie/min-point-size-100/
        *         minPointSize set to 100
        * @type {String|Number}
        * @since 7.0.0
        * @product highcharts
        */
        minPointSize: '10%',
        /**
        * The maximum size of the points' radius related to chart's `plotArea`.
        * If a number is set, it applies in pixels.
        *
        * @sample {highcharts}
        *         highcharts/variable-radius-pie/min-max-point-size/
        *         Example of minPointSize and maxPointSize
        * @type {String|Number}
        * @since 7.0.0
        * @product highcharts
        */
        maxPointSize: '100%',
        sizeBy: 'radius',
        zoneAxis: 'y',
        tooltip: {
            pointFormat: 'Value: {point.y}'
        }
    }, {
        isCartesian: false,
        /**
         * Create a single array of all points from all series
         *
         * @param {Array} Array of all series objects
         * @return {Array} Returns the array of all points.
         *
         */
        accumulateAllPoints: function (series) {

            var chart = series.chart,
                allDataPoints = [],
                i, j;

            for (i = 0; i < chart.series.length; i++) {

                series = chart.series[i];

                if (series.visible) {

                    // add data to array only if series is visible
                    for (j = 0; j < series.processedYData.length; j++) {
                        allDataPoints.push([
                            null, null,
                            series.processedYData[j],
                            series.index,
                            j
                        ]);
                    }
                }
            }

            return allDataPoints;
        },
        /**
         * Extend the base translate method to handle bubble size,
         * and correct positioning them
         */
        translate: function () {

            var positions, // calculated positions of bubbles in bubble array
                series = this,
                chart = series.chart,
                data = series.data,
                index = series.index,
                point,
                radius,
                i;

            // merged data is an array with all of the data from all series
            this.allDataPoints = series.accumulateAllPoints(series);

            // calculate radius for all added data
            series.getRadius();

            // after getting initial radius, calculate bubble positions
            positions = this.placeBubbles(this.allDataPoints);

            // Run the parent method
            H.seriesTypes.scatter.prototype.translate.call(this);

            // Set the shape type and arguments to be picked up in drawPoints
            for (i = 0; i < positions.length; i++) {

                if (positions[i][3] === index) {

                    // update the series points with the values from positions
                    // array
                    point = data[positions[i][4]];
                    radius = positions[i][2];
                    point.plotX = positions[i][0] - chart.plotLeft +
                      chart.diffX;
                    point.plotY = positions[i][1] - chart.plotTop +
                      chart.diffY;

                    point.marker = H.extend(point.marker, {
                        radius: radius,
                        width: 2 * radius,
                        height: 2 * radius
                    });

                    // Alignment box for the data label
                    point.dlBox = {
                        x: point.plotX - radius,
                        y: point.plotY - radius,
                        width: 2 * radius,
                        height: 2 * radius
                    };
                }
            }
        },
        /**
         * Check if two bubbles overlaps.
         * @param {Array} first bubble
         * @param {Array} second bubble
         *
         * @return {Boolean} overlap or not
         *
         */
        checkOverlap: function (bubble1, bubble2) {
            var diffX = bubble1[0] - bubble2[0], // diff of X center values
                diffY = bubble1[1] - bubble2[1], // diff of Y center values
                sumRad = bubble1[2] + bubble2[2]; // sum of bubble radius

            return (
                Math.sqrt(diffX * diffX + diffY * diffY) -
                Math.abs(sumRad)
            ) < -0.001;
        },
        /* Function that is adding one bubble based on positions and sizes
         * of two other bubbles, lastBubble is the last added bubble,
         * newOrigin is the bubble for positioning new bubbles.
         * nextBubble is the curently added bubble for which we are
         * calculating positions
         *
         * @param {Array} The closest last bubble
         * @param {Array} New bubble
         * @param {Array} The closest next bubble
         *
         * @return {Array} Bubble with correct positions
         *
         */
        positionBubble: function (lastBubble, newOrigin, nextBubble) {
            var sqrt = Math.sqrt,
                asin = Math.asin,
                acos = Math.acos,
                pow = Math.pow,
                abs = Math.abs,
                distance = sqrt( // dist between lastBubble and newOrigin
                  pow((lastBubble[0] - newOrigin[0]), 2) +
                  pow((lastBubble[1] - newOrigin[1]), 2)
                ),
                alfa = acos(
                  // from cosinus theorem: alfa is an angle used for
                  // calculating correct position
                  (
                    pow(distance, 2) +
                    pow(nextBubble[2] + newOrigin[2], 2) -
                    pow(nextBubble[2] + lastBubble[2], 2)
                  ) / (2 * (nextBubble[2] + newOrigin[2]) * distance)
                ),

                beta = asin( // from sinus theorem.
                  abs(lastBubble[0] - newOrigin[0]) /
                  distance
                ),
                // providing helping variables, related to angle between
                // lastBubble and newOrigin
                gamma = (lastBubble[1] - newOrigin[1]) < 0 ? 0 : Math.PI,
                // if new origin y is smaller than last bubble y value
                // (2 and 3 quarter),
                // add Math.PI to final angle

                delta = (lastBubble[0] - newOrigin[0]) *
                (lastBubble[1] - newOrigin[1]) < 0 ?
                1 : -1, // (1st and 3rd quarter)
                finalAngle = gamma + alfa + beta * delta,
                cosA = Math.cos(finalAngle),
                sinA = Math.sin(finalAngle),
                posX = newOrigin[0] + (newOrigin[2] + nextBubble[2]) * sinA,
                // center of new origin + (radius1 + radius2) * sinus A
                posY = newOrigin[1] - (newOrigin[2] + nextBubble[2]) * cosA;

            return [
                posX,
                posY,
                nextBubble[2],
                nextBubble[3],
                nextBubble[4]
            ]; // the same as described before
        },
        /*
         * This is the main function responsible
         * for positioning all of the bubbles
         * allDataPoints - bubble array, in format [pixel x value,
         * pixel y value, radius,
         * related series index, related point index]
         *
         * @param {Array} All points from all series
         *
         * @return {Array} Positions of all bubbles
         *
         */
        placeBubbles: function (allDataPoints) {

            var series = this,
                checkOverlap = series.checkOverlap,
                positionBubble = series.positionBubble,
                bubblePos = [],
                stage = 1,
                j = 0,
                k = 0,
                calculatedBubble,
                sortedArr,
                i;

            // sort all points
            sortedArr = allDataPoints.sort(function (a, b) {
                return b[2] - a[2];
            });

            // if length is 0, return empty array
            if (!sortedArr.length) {
                return [];
            } else if (sortedArr.length < 2) {
                // if length is 1,return only one bubble
                return [
                    0, 0,
                    sortedArr[0][0],
                    sortedArr[0][1],
                    sortedArr[0][2]
                ];
            }

            // create first bubble in the middle of the chart
            bubblePos.push([
                [
                    0, // starting in 0,0 coordinates
                    0,
                    sortedArr[0][2], // radius
                    sortedArr[0][3], // series index
                    sortedArr[0][4]
                ] // point index
            ]); // 0 level bubble

            bubblePos.push([
                [
                    0,
                    0 - sortedArr[1][2] - sortedArr[0][2],
                    // move bubble above first one
                    sortedArr[1][2],
                    sortedArr[1][3],
                    sortedArr[1][4]
                ]
            ]); // 1 level 1st bubble

            // first two already positioned so starting from 2
            for (i = 2; i < sortedArr.length; i++) {
                sortedArr[i][2] = sortedArr[i][2] || 1;
                // in case if radius is calculated as 0.

                calculatedBubble = positionBubble(
                    bubblePos[stage][j],
                    bubblePos[stage - 1][k],
                    sortedArr[i]
                ); // calculate initial bubble position

                if (checkOverlap(calculatedBubble, bubblePos[stage][0])) {
                    /* if new bubble is overlapping with first bubble
                     * in current level (stage)
                     */

                    bubblePos.push([]);
                    k = 0;
                    /* reset index of bubble, used for positioning the bubbles
                     * around it, we are starting from first bubble in next
                     * stage because we are changing level to higher
                     */
                    bubblePos[stage + 1].push(
                      positionBubble(
                        bubblePos[stage][j],
                        bubblePos[stage][0],
                        sortedArr[i]
                      )
                    );
                    // (last added bubble, 1st. bbl from cur stage, new bubble)
                    stage++; // the new level is created, above current one
                    j = 0; // set the index of bubble in current level to 0
                } else if (
                    stage > 1 && bubblePos[stage - 1][k + 1] &&
                    checkOverlap(calculatedBubble, bubblePos[stage - 1][k + 1])
                ) {
                    /* if new bubble is overlapping with one of the previous
                     * stage bubbles, it means that - bubble, used for
                     * positioning the bubbles around it has changed
                     * so we need to recalculate it
                     */
                    k++;
                    bubblePos[stage].push(
                      positionBubble(bubblePos[stage][j],
                        bubblePos[stage - 1][k],
                        sortedArr[i]
                      ));
                    // (last added bubble, previous stage bubble, new bubble)
                    j++;
                } else { // simply add calculated bubble
                    j++;
                    bubblePos[stage].push(calculatedBubble);
                }
            }
            series.chart.stages = bubblePos;
            // it may not be necessary but adding it just in case -
            // it is containing all of the bubble levels

            series.chart.rawPositions = [].concat.apply([], bubblePos);
            // bubble positions merged into one array

            series.resizeRadius();

            return series.chart.rawPositions;
        },
        /*
        * The function responsible for resizing the bubble radius.
        * In shortcut: it is taking the initially
        * calculated positions of bubbles. Then it is calculating the min max
        * of both dimensions, creating something in shape of bBox.
        * The comparison of bBox and the size of plotArea
        * (later it may be also the size set by customer) is giving the
        * value how to recalculate the radius so it will match the size
        */
        resizeRadius: function () {

            var chart = this.chart,
                positions = chart.rawPositions,
                min = Math.min,
                max = Math.max,
                plotLeft = chart.plotLeft,
                plotTop = chart.plotTop,
                chartHeight = chart.plotHeight,
                chartWidth = chart.plotWidth,
                minX, maxX, minY, maxY,
                radius,
                bBox,
                spaceRatio,
                smallerDimension,
                i;

            minX = minY = Number.POSITIVE_INFINITY; // set initial values
            maxX = maxY = Number.NEGATIVE_INFINITY;

            for (i = 0; i < positions.length; i++) {
                radius = positions[i][2];
                minX = min(minX, positions[i][0] - radius);
                // (x center-radius) is the min x value used by specific bubble
                maxX = max(maxX, positions[i][0] + radius);
                minY = min(minY, positions[i][1] - radius);
                maxY = max(maxY, positions[i][1] + radius);
            }

            bBox = [maxX - minX, maxY - minY];
            spaceRatio = [
                (chartWidth - plotLeft) / bBox[0],
                (chartHeight - plotTop) / bBox[1]
            ];

            smallerDimension = min.apply([], spaceRatio);

            if (Math.abs(smallerDimension - 1) > 1e-10) {
                // if bBox is considered not the same width as possible size
                for (i = 0; i < positions.length; i++) {
                    positions[i][2] *= smallerDimension;
                }
                this.placeBubbles(positions);
            } else {
                /* if no radius recalculation is needed, we need to position
                * the whole bubbles in center of chart plotarea
                * for this, we are adding two parameters,
                * diffY and diffX, that are related to differences
                * between the initial center and the bounding box
                */
                chart.diffY = chartHeight / 2 +
                    plotTop - minY - (maxY - minY) / 2;
                chart.diffX = chartWidth / 2 +
                    plotLeft - minX - (maxX - minX) / 2;
            }
        },

        /* Small change in default getRadius method,
         * so it is accepting the current bubble array format.
         */
        getRadius: function () { // bubbles array
            var series = this,
                chart = series.chart,
                plotWidth = chart.plotWidth,
                plotHeight = chart.plotHeight,
                seriesOptions = series.options,
                smallestSize = Math.min(plotWidth, plotHeight),
                extremes = {},
                radii = [],
                sizeByArea = this.options.sizeBy !== 'width',
                allDataPoints = this.allDataPoints,
                minSize,
                maxSize,
                pos,
                radiusRange,
                value,
                radius;

            each(['minPointSize', 'maxPointSize'], function (prop) {
                var length = parseInt(seriesOptions[prop], 10),
                    isPercent = /%$/.test(length);

                extremes[prop] = isPercent ?
                    smallestSize * length / 100 :
                    length;
            });

            chart.minRadius = minSize = extremes.minPointSize;
            chart.maxRadius = maxSize = extremes.maxPointSize;

            // range of size
            radiusRange = maxSize - minSize;

            each(allDataPoints, function (point, i) {

                value = point[2];

                // part of bubble's algorithm (getRadii)
                if (value === null || value === 0) {
                    radius = null;
                    // Issue #4419 - if value is less than zMin, push a radius
                    // that's always smaller than the minimum size
                } else if (value < minSize) {
                    radius = minSize - 1;
                } else {
                    pos = radiusRange > 0 ?
                            (value - minSize) / radiusRange :
                            0.5;

                    if (sizeByArea && pos >= 0) {
                        pos = Math.sqrt(pos);
                    }
                    radius = Math.ceil(minSize + pos * (maxSize - minSize)) / 2;
                }

                allDataPoints[i][2] = radius;
                radii.push(radius);
            });

            this.radii = radii;
        }
    }
);

/**
 * A `packedbubble` series. If the [type](#series.packedbubble.type) option is
 * not specified, it is inherited from [chart.type](#chart.type).
 *
 * @type      {Object}
 * @extends   series,plotOptions.packedbubble
 * @excluding dataParser,dataURL,stack
 * @product   highcharts highstock
 * @apioption series.packedbubble
 */

/**
 * An array of data points for the series. For the `packedbubble` series type,
 * points can be given in the following ways:
 *
 * 1.  An array of `y` values.
 *
 *  ```js
 *     data: [5, 1, 20]
 *  ```
 *
 * 2.  An array of objects with named values. The objects are point
 * configuration objects as seen below. If the total number of data points
 * exceeds the series' [turboThreshold](#series.packedbubble.turboThreshold),
 * this option is not available.
 *
 *  ```js
 *     data: [{
 *         y: 1,
 *         name: "Point2",
 *         color: "#00FF00"
 *     }, {
 *         y: 5,
 *         name: "Point1",
 *         color: "#FF00FF"
 *     }]
 *  ```
 *
 * @type      {Array<Object|Array>}
 * @extends   series.line.data
 * @excluding marker
 * @sample    {highcharts} highcharts/series/data-array-of-objects/
 *            Config objects
 * @product   highcharts
 * @apioption series.packedbubble.data
 */

/**
 * @excluding enabled,enabledThreshold,height,radius,width
 * @apioption series.packedbubble.marker
 */
