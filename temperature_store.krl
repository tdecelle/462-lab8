ruleset temperature_store {

	meta {
		provides temperatures, threshold_violations, inrange_temperatures
		shares temperatures, threshold_violations, inrange_temperatures
	}

	global {
		temperatures = function() {
			ent:temperatures.defaultsTo([])
		}

		threshold_violations = function() {
			ent:threshold_violations.defaultsTo([])
		}

		inrange_temperatures = function() {
			ent:temperatures.defaultsTo([]).difference(ent:threshold_violations.defaultsTo([]))
		}
	}

	rule get_temperatures {
		select when sensor temperatures

		pre {
			temps = temperatures()
			id = event:attr("sensor_id")
			eci = event:attr("return_eci")
			report_id = event:attr("report_id")
		}

		event:send({
			"eci":eci,
			"eid":"temperature",
			"domain":"sensor",
			"type":"released_temperature",
			"attrs":{
				"temps":temps, 
				"sensor_id":id,
				"report_id":report_id
			}
		})
	}
	
	rule collect_temperatures {
		select when wovyn new_temperature_reading

		always {
			ent:temperatures := ent:temperatures.defaultsTo([]).append(event:attrs)
		}
	}

	rule collect_threshold_violations {
		select when wovyn threshold_violation

		always {
			ent:threshold_violations := ent:threshold_violations.defaultsTo([]).append(event:attrs)
		}
	}

	rule clear_temperatures {
		select when sensor reading_reset

		always {
			ent:temperatures := []
			ent:threshold_violations := []
		}
	}
}
