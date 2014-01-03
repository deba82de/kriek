//                      _                       
//                     | |                      
//  _ __ __ _ ___ _ __ | |__  _ __ _____      __
// | '__/ _` / __| '_ \| '_ \| '__/ _ \ \ /\ / /
// | | | (_| \__ \ |_) | |_) | | |  __/\ V  V / 
// |_|  \__,_|___/ .__/|_.__/|_|  \___| \_/\_/  
//               | |                            
//               |_|                            
//
//  RaspBrew v3.0
//

function RaspBrew() {
	var _this = this;
	
	this.lastChartData = null;
	this.lastLoadedData = null;
	this._systemStatus = null;
	
	this.updateTime = 2000;
	this.updateSystemSettingsTime = 20000;
	this.chartPoints = 50;
	
	this.colourList = ['#DD6E2F','#DD992F','#285890','#1F9171','#7A320A','#7A4F0A','#082950','#06503C'];
	this._chartUpdatesEnabled = true;
	
	//converts to fahrenheit if necessary
	//all temps are stored in C on the server and converted here to imperial.
	this.getTemperature = function(temp) {
		if (_this._systemStatus && _this._systemStatus.units != 'metric') {
			return (9.0/5.0)*parseFloat(temp) + 32;
		} else {
			return parseFloat(temp);
		}
	}
	
	// This is constantly called to update the data via ajax.
	this.updateStatus = function() {
		
		var url = '/status/' + _this.chartPoints;
		
		var startDateEnabled = $("#startDate").attr('disabled') === undefined && !$("#startDate").is(":focus");
		var endDateEnabled = $("#endDate").attr('disabled') === undefined && !$("#endDate").is(":focus");
		
		if (startDateEnabled || endDateEnabled) {
			var sd = null;
			var ed = (new Date).getTime();
			
			startDateValue = $("#startDate").val();
			if (startDateValue) {
				sd = new Date($("#startDate").datetimepicker('getDate'));
				url = url + '/' + parseInt(sd.getTime()/1000);
				
				endDateValue = $("#endDate").val();
				if (endDateEnabled && endDateValue) {
					ed = new Date($("#endDate").datetimepicker('getDate'));
					url = url + '/' + parseInt(ed.getTime()/1000);
				}
			}
		}
		
		$.ajax({
			url: url,
			type: 'GET',
			dataType: 'json',
			success: function(data){ 
				if (data) {
					_this.updateFromData(data);
					
					//set this after the update so we know what we currently have loaded
					_this.lastLoadedData=data[0];
				}
				
				setTimeout(_this.updateStatus, _this.updateTime);
			},
			error: function(data) {
				//alert('woops!'); //or whatever
				setTimeout(_this.updateStatus, _this.upateTime);
			}
		});
	};
	
	// This is called to update the system status.
	this.updateSystemStatus = function() {
		$.ajax({
			url: "/status/system",
			type: 'GET',
			dataType: 'json',
			success: function(data){ 
				_this._systemStatus = data;
				if (data) {
					if (data.serverrunning) {
						$('#serverstatus').addClass('hidden');
					} else {
						$('#serverstatus').removeClass('hidden');
					}
				}
				
				if (data.units) {
					//update all the temp labels
					$('.templabel').each(function(index, item) { 
						var h = $(item).html();
						var fc = data.units == "metric" ? "c" : "f";
						xh = h.replace(/\(.*\)/g, "(" + fc + ")");
						$(item).html(xh);
					});
				}
				
				setTimeout(_this.updateSystemStatus, _this.updateSystemSettingsTime);
			},
			error: function(data) {
				//alert('woops!'); //or whatever
				setTimeout(_this.updateSystemStatus, _this.updateSystemSettingsTime);
			}
		});
	};
	
	// Updates the UI as needed
	this.updateFromData = function(data) {
	
		//we are waiting for the server to update the data
		if (this._writingData) {
			return;
		}
	
		if (!data || data.length==0) {
			$('.raspbrew_updateable').html('--');
			this.emptyChart();
			return;
		}
		
		var latest = data[0];
		if (latest && _this.lastLoadedData && (latest.date == _this.lastLoadedData.date)) {
			//no need to update
			return;
		}
		
		for (var probeid in latest.probes) {
			var probe = latest.probes[probeid];
			var tempInput = $('#probe' + probeid + '_temp');
			var ttempInput = $('#probe' + probeid + '_target');
			
			var temp = parseFloat(probe.temp);
			var targetTemp = NaN;
			if (probe.target_temp) {
				targetTemp = parseFloat(probe.target_temp);
			}
			
			if (! tempInput.is(":focus"))
				tempInput.html(temp.toFixed(2));
			if (! ttempInput.is(":focus") && ! ttempInput.parent().hasClass('has-success')) {
				if (probe.target_temp) {
					ttempInput.val(targetTemp.toFixed(2));
				} else {
					ttempInput.val("");
				}
			}
			
			//how close are we to the target temp?
			if (!isNaN(temp) && !isNaN(targetTemp)) {
				var percent = Math.min(temp, targetTemp)/Math.max(temp, targetTemp);
				var color=jQuery.Color().hsla(120, 1, percent/2, 1);
				tempInput.animate({
				  color: color
			  	}, 1500 );
			}
			
			//set the eta and degrees per hour
			if (probe.eta) {
				var eta=probe.eta*1000;
				var eta=new Date(eta);
				eta=moment(eta).fromNow(true);
				$('#probe' + probeid + '_eta').html(eta);
			} else {
				$('#probe' + probeid + '_eta').html('--');
			}
			
			if (probe.dpm) {
				var dpm = parseFloat(probe.dpm).toFixed(3);
				//$('#probe' + probeid + '_dpm').parent().removeClass("hidden");
				$('#probe' + probeid + '_dpm').html(dpm);
			} else {
				//$('#probe' + probeid + '_dpm').parent().addClass("hidden");
				$('#probe' + probeid + '_dpm').html('--');
			}
			
		}
		
		for (var ssrid in latest.ssrs) {
			var ssr = latest.ssrs[ssrid];
			if (! $('#ssr' + ssrid).is(":focus")) {
				
				$('#ssr' + ssrid + "_icon").removeClass("fa-check-square-o");
				$('#ssr' + ssrid + "_icon").removeClass("fa-square-o");
				$('#ssr' + ssrid).removeClass("powerOff");
				$('#ssr' + ssrid).removeClass("power");
				
				if (ssr.state) {
					$('#ssr' + ssrid + "_icon").addClass("fa-check-square-o");
					$('#ssr' + ssrid).addClass("power");
				} else {
					$('#ssr' + ssrid + "_icon").addClass("fa-square-o");
					$('#ssr' + ssrid).addClass("powerOff");
				}
			}
		}
		
		//update the chart
		if (this._chartUpdatesEnabled) {
			_this.updateChart(data);
		}
	}
	
	// Clears out the chart if there's no data
	this.emptyChart = function() {
		if (this.chart) {
			var datum = _this.lastLoadedData;
			if (datum) {
				for (var i=0;i<datum.length;i++) {
					datum[i].values = [{x:0,y:0}];
				}
			} else {
				datum = [ 
					{ 
					  "key" : "" , 
					  "values" : []
					}

				]
			}
			//update the chart
			d3.select('#tempChart svg')
			.datum(datum)
			.transition().duration(500)
			.call(this.chart);
		}
	}
	
	// Updates the chart with the current data set
	this.updateChart = function(data) {
		  
		var dd = {};
		var values = [];

		for (var i = 0; i < data.length; i++) {
			var d = data[i];
			for (var probeid in d.probes) {
				var probe = d.probes[probeid];
				if (!dd[probeid]) {
					dd[probeid] = []
				}
				var date = new Date(parseInt(d.date)*1000);
				var temp = probe.temp;
				
				temp=_this.getTemperature(probe.temp)
				
				dd[probeid].push({x: date, y: temp});
			}
		}

		var datum=[];
		var d = data[0];
		var count=0;
		for (var probeid in dd) {
			if (d.probes && d.probes[probeid]) {
				datum.push({ values: dd[probeid], key: d.probes[probeid].name, color:this.colourList[count++] });
			}
		}
		
		this.lastChartData = datum;
		
		if (this.chart) {
			//update the chart
			d3.select('#tempChart svg')
			.datum(datum)
			.transition().duration(500)
			.call(this.chart);
		}
	
	}
	
	//create the chart
	this.createChart = function() {
		  
		nv.addGraph(function() {
		  _this.chart = nv.models.lineChart()
		  .options({
			//margin: {left: 100, bottom: 100},
			showXAxis: true,
			showYAxis: true,
			//transitionDuration: 250
		  })
		  ;

		  // chart sub-models (ie. xAxis, yAxis, etc) when accessed directly, return themselves, not the parent chart, so need to chain separately
		  _this.chart.xAxis
			.axisLabel("Time (s)")
			.tickFormat(function(d) {
				//why do i have to do this??
				return d3.time.format("%H:%M:%S")(new Date(d));
			})
			
		  _this.chart.yAxis
			.axisLabel('Temperature (c)')
			.tickFormat(d3.format(',.2f'));

		  nv.utils.windowResize(_this.chart.update);

		  _this.chart.dispatch.on('stateChange', function(e) { nv.log('New State:', JSON.stringify(e)); });

		  return _this.chart;
		});
	}
	
	//sets the time - starttime and endtime are both moment objects
	this.quickTime = function(startTime, endTime) {
		$('#startDateCheckbox').prop('checked', true);
		$('#endDateCheckbox').prop('checked', true);
		$('#startDate').prop('disabled', false);
		$('#endDate').prop('disabled', false);
		$("#startDate").datetimepicker('setDate', startTime.toDate() );
		$("#endDate").datetimepicker('setDate', endTime.toDate() );
	}
	
	//updates the target temperature of the given probe id
	this.updateTargetTemp = function(input, probeid) {
	
		input=$('#'+input)
		$(input).parent().removeClass('has-success');
		
		//validate the input
		var val=input.val();
		if (val == "") {
			val = null;
		} else {
			var val=parseFloat(val);
			if (isNaN(val) || val > 999) {
				input.parent().addClass('has-error');
				return;
			} 
			input.val(val.toFixed(2));
		}		
		
		$('.raspbrew_updateable').attr('disabled', true);
		
		this._writingData = true;
		
		var post = { probes: [ { pk: probeid, target_temperature: val } ]  };
		$.ajax({
			url: "/update",
			type: 'POST',
			dataType: 'json',
			data: JSON.stringify(post),
			success: function(data){ 
				$('.raspbrew_updateable').attr('disabled', false);
				setTimeout(function(){_this._writingData = false;}, 10000);
			},
			error: function() {
				$('.raspbrew_updateable').attr('disabled', false);
				_this._writingData = false;			
			}
		});
	}
	
	//this sets wether or not we should be updating the char
	this.setChartUpdatesEnabled = function(enabled) {
		this._chartUpdatesEnabled = enabled;
		if (enabled) {
			$('#chartUpdates').html('Chart Updates Enabled');
		} else {
			$('#chartUpdates').html('Chart Updates Disabled');
		}
	}
	
	//shows a configuration dialog for a given ssr
	this.configureSSR = function(ssrid, ssrname) {
		
		var data = _this.lastLoadedData;
		
		if (data) {
			_this._editingSSR = data.ssrs[ssrid];
			_this._editingSSR.id = ssrid;
			
			$('#ssrEnabled').prop('checked')
			$('#ssrEnabled').prop('checked', this._editingSSR.enabled)
			$('#ssrModalTitle').html(_this._editingSSR.name);
			$('#ssrModal').modal({});
		}
	}

	//saves the ssr from the modal dialog
	this.saveSSRConfig = function() {
		if (!_this._editingSSR) {
			return;
		}
		
		var post = { ssrs: [ { pk: _this._editingSSR.id, enabled: $('#ssrEnabled').prop('checked') ? 1 : 0 } ]  };
		
		$.ajax({
			url: "/update",
			type: 'POST',
			dataType: 'json',
			data:  JSON.stringify(post),
			success: function(data){ 
				$('.raspbrew_updateable').attr('disabled', false);
				setTimeout(function(){_this._writingData = false;}, 10000);
			},
			error: function() {
				$('.raspbrew_updateable').attr('disabled', false);
				_this._writingData = false;			
			}
		});	
		
		$('#ssrModal').modal('hide');
	}

	$( document ).ready(function() {
		_this.createChart();
		_this.updateStatus();
		_this.updateSystemStatus();
		$("#startDate").datetimepicker();
		$("#endDate").datetimepicker();
	});
	
	return this;
};

var raspbrew = new RaspBrew();

