GPS TRACKING | Node.js 
==============

This module let you easily create listeners for your GPS tracking devices. You can add your custom implementations to handle more protocols. 

#### Currently supported models
- GT02A
- GT06
- TK103

# Installation   

## Step by step

1) [Install Node](https://nodejs.org/)

2) Create a folder for your project

3) Copy the example code above in a .js file like server.js

4) Install the package in the project folder
``` bash
cd /path/to/my/project
npm install https://github.com/cnberg/gps-tracking-nodejs/tree/master/
```
5) Run your server (server.js example below)
``` bash
node server.js
```

## Usage
Once you have installed the package, you can use it like: 

``` javascript
var gps = require("gps-tracking");

var options = {
    'debug'                 : true,
    'port'                  : 8090,
    'device_adapter'        : "TK103"
}

var server = gps.server(options,function(device,connection){

    device.on("login_request",function(device_id,msg_parts){

        // Some devices sends a login request before transmitting their position
        // Do some stuff before authenticate the device... 
        
        // Accept the login request. You can set false to reject the device.
        this.login_authorized(true); 

    });


    //PING -> When the gps sends their position  
    device.on("ping",function(data){

        //After the ping is received, but before the data is saved
        //console.log(data);
        return data;

    });

});
```

And you can get track trace on http://localhost:55023 (If your GPS receive port is 5023).


# Overview
With this package you are going to create a tcp server that listens on a open port of your server/computer for a specific gps device model. 
For example, you are going to listen on port 8090 for 'TK103 gps-trackers'. 

If you want to listen for different kind of trackers, you have to create another tcp server. You can do this in a different node.js program in the same server, but you have to listen in a different port. 

So, you can  listen on port 8090 for TK103 devices and listen on 8091 for TK102 devices (or any gps-tracker you want)

# Options
#### debug
Enables console.log messages. 
``` javascript
    "debug":false, 
```
#### port
The port to listen to. Where the packages of the device will arrive. 
``` javascript
    "port": 8080,
```

#### device_adapter
Which device adapter will be used to parse the incoming packets. 
``` javascript
    "device_adapter": false, 
    // If false, the server will throw an error. 
    // At the moment, the modules comes with only one adater: TK103.
    "device_adapter": "TK103"
    // You can create your own adapter. 
    
    //FOR USING A CUSTOM DEVICE ADAPTER
     "device_adapter": require("./my_custom_adapter")
```

# Events
Once you create a server, you can access to the connection and the device object connected. Both objects emits events you can listen on your app. 
```javascript
var server = gps.server(options,function(device,connection){
    //conection = net.createServer(...) object
    //device = Device object
}
```

#### connection events
Available events: 
- end
- data
- close
- timeout
- drain

You can [check the documentation of node.js net object here](http://nodejs.org/api/net.html#net_net_createserver_options_connectionlistener).

``` javascript
//Example: 
var server = gps.server(opts,function(device,connection){
    connection.on("data",function(res){
		//When raw data comes from the device
	});
});
```

### Device object events
Every time something connects to the server, a net connection and a new device object will be created.
The Device object is your interface to send & receive packets/commands. 

``` javascript
var request = require('request');
var gps = require("./gps-tracking-nodejs");


//  init mqtt connection
var mqtt    = require('mqtt');
var mqttConnected = false;

var MQTT_ADDR = "mqtt://***";
var MQTT_PORT = 1883;

var client  = mqtt.connect('mqtt://***', {
    "username": "***",
    "password": "***",
});
 
client.on('connect', function () {
    console.log("mqtt connected");
    mqttConnected = true;
});
client.on('error', function(){
    console.log("ERROR")
    client.end()
});
// ---- mqtt end ----


var server = gps.server({
    'debug': true,
    'port': 5023,
    'device_adapter': "GT06",
    'gpx_log_location': "/path/to/gpx/"
},function(device, connection){
    device.on("login_request",function(device_id,msg_parts){
        this.login_authorized(true); 
    });

    //PING -> When the gps sends their position  
    device.on("ping",function(data){
        // push current location info to home assistant
        request({
            headers: {
                'Content-Type': 'application/json',
                'x-ha-access': '***'
            },
            uri: 'https://***/api/states/sensor.motor_location',
            method: 'POST',
            json: {"state": "on", "attributes": data}
        },  function (err, res, body) { });

        // push current location to home assistant by mqtt
        if(mqttConnected){
            client.publish('location/motor', JSON.stringify({"longitude": data.longitude, "latitude": data.latitude,}));
        }
        return data;
    });
});
```


# Custom adapters
You have to create and exports an adapter function. 
```javascript
exports.protocol="GPS103";
exports.model_name="TK103";
exports.compatible_hardware=["TK103/supplier"];

var adapter = function(device){
    //Code that parses and respond to commands
}
exports.adapter = adapter;
```
#### Functions you have to implement
##### function parse_data(data)
You receive the data and you have to return an object with: 

```javascript
return {
    'device_id': 'string',
    // ID of the device. Mandatory
    
    'cmd': 'string',
    //'string' Represents what the device is trying to do. You can send some of the available commands or a custom string. Mandatory
    
    'data': 'string'
    //Aditional data in the packet. Mandatory
}
```

