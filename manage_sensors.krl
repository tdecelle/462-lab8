ruleset manage_sensors {

	meta {
		use module io.picolabs.subscription alias Subscriptions
		use module io.picolabs.wrangler alias wrangler
		shares __testing, sensors, getAllTemperatures, getReports
		provides getAllTemperatures, sensors, getReports
	}

	global {
		default_location = "pandora"
		default_sms = "19134019979"
		default_threshold = 80

		getAllTemperatures = function() {
			Subscriptions:established("Tx_role", "sensor").map(function(subscription) {
				subscription = subscription.klog("getAllTemperatures subscription").head()
				wrangler:skyQuery(subscription{"Tx"}, "temperature_store", "temperatures", {})
			})
		}

		getReports = function() {
			ent:reports.defaultsTo([]).slice(
				(ent:reports.length() > 5) => ent:reports.length()-5 | 0,
				ent:reports.length()-1
			) 
		}

		getChildren = function() {
			wrangler:children()
		}

		nameFromID = function(name) {
			"Sensor " + name + " Pico"
		}

		sensors = function() {
			ent:sensors
		}

		__testing = { 	"queries": [
							{"name": "getAllTemperatures", "args": []},
							{"name": "getReports", "args":[]}
						],
						"events": [ 
									{ "domain": "sensor", "type": "new_sensor", "attrs": [ "sensor_id" ] }, 
									{ "domain": "sensor", "type": "unneeded_sensor", "attrs": ["sensor_id"] }, 
									{ "domain": "sensor", "type": "subscription_wanted", "attrs": ["sensor_id", "eci"] },
									{ "domain": "sensor", "type": "requested_report", "attrs": [] }
								] 
		}
	}

	rule create_sensor {
		select when sensor new_sensor

		pre {
			sensor_id = event:attr("sensor_id")
			exists = ent:sensors.keys() >< sensor_id
			eci = meta:eci
		}
		
		if exists then
			send_directive("sensor_ready", {"sensor_id":sensor_id})
		notfired {
			ent:sensors := ent:sensors.defaultsTo({}).put([sensor_id], "")

			raise wrangler event "child_creation"
				attributes { "name": nameFromID(sensor_id), "color": "#ffff00", "sensor_id": sensor_id, "rids": ["sensor_profile", "wovyn_base", "temperature_store", "io.picolabs.subscription"] }
		}
	}

	rule initialize_sensor_profile {
		select when wrangler child_initialized

		pre {
			sensor_id = event:attr("sensor_id")
			exists = ent:sensors.keys() >< sensor_id
			eci = event:attr("eci").klog("SETTING ECI")
		}

		if exists then
			event:send(
				{
					"eci": eci, "eid": "initialize-sensor-profile",
					"domain": "sensor", "type": "profile_updated",
					"attrs": { "location": default_location, "name": section_id, "sms": default_sms, "high_temperature": default_threshold }
				})
		fired {
			raise wrangler event "subscription" attributes {
			  "name": "sensors",
			  "wellKnown_Tx": eci,
			  "Rx_role":"manager",
			  "Tx_role":"sensor"
			}
		}
	}

	rule subscribe_sensor {
		select when sensor subscription_wanted

		pre {
			sensor_id = event:attr("sensor_id")
			exists = Subscriptions:established("Tx_role", "sensor").any(function(x) {x{"peer_id"} == sensor_id})
		}

		always {
			raise wrangler event "subscription" attributes {
			  "name": "sensors",
			  "wellKnown_Tx": event:attr("eci"),
			  "Rx_role":"manager",
			  "Tx_role":"sensor"
			}
		}
	}

	rule delete_sensor {
		select when sensor unneeded_sensor
		
		pre {
			sensor_id = event:attr("sensor_id").klog("sensor_id").head()
			exists = ent:sensors.keys() >< sensor_id
			child_to_delete = nameFromID(sensor_id)
		}

		if exists then
			send_directive("deleting_sensor", {"sensor_id":sensor_id})
		fired {
			ent:sensors := ent:sensors.delete([sensor_id])

			raise wrangler event "child_deletion"
				attributes {"name": child_to_delete}
		}
	}

	rule request_all_temperatures {
		select when sensor requested_report
		
		foreach Subscriptions:established("Tx_role", "sensor") setting (subscription)

		if (subscription{"Tx_role"}.klog("TX_ROLE") == "sensor") then
			event:send({
				"eci":subscription{"Tx"},
				"eid":"getting_temperatures",
				"domain":"sensor",
				"type":"temperatures",
				"attrs":{
					"return_eci":subscription{"Rx"},
					"sensor_id":subscription{"Tx"},
					"report_id":ent:report_id.defaultsTo(1)
				}
			})

			always {
				ent:report_id := (ent:report_id.defaultsTo(1) + 1).klog("report_id: ") on final
			}
	}

	rule get_all_temperatures {
		select when sensor released_temperature

		always {
			sensor_id = event:attr("sensor_id")
			temps = event:attr("temps")
			report_id = event:attr("report_id").klog("Return report_id:")

			ent:reports := (ent:reports.length() <= event:attr("report_id")) => ent:reports.defaultsTo([]).append({}.put(
				report_id,
				{
					"temperature_sensors":Subscriptions:established("Tx_role", "sensor").length(),
					"responding":0,
					"temperatures":[]
				}
			)) | ent:reports

			ent:reports := ent:reports.map(function(report) {
				(not report{report_id}.isnull())  => 
					report.set([report_id], 
						{
							"temperature_sensors":report{report_id}{"temperature_sensors"},
							"responding":(report{report_id}{"responding"}+1),
							"temperatures":report{report_id}{"temperatures"}.append(temps)
						}	
					) |
					report
			})

			ent:reports := ent:reports.klog("Reports: ")
		}
	}
}
