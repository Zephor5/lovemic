
/*
 author:cyhu(viskey.hu@gmail.com) 2014.6.26

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in
 the documentation and/or other materials provided with the distribution.

 3. The names of the authors may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
 INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
/**************************************************Constant**************************************************************/
var KEY_QISR_SESSION_BEGIN          =     'qisrsessionbegin';
	
var	KEY_QISR_AUDIO_WRITE            =     'qisraudiowrite';

var	KEY_QISR_GET_RESULT             =     'qisrgetresult';

var	KEY_QISR_SESSION_END            =     'qisrsessionend';

var KEY_QISR_GET_PARAM              =     'qisrgetparam';

var KEY_QISR_SET_PARAM              =     'qisrsetparam';

var INTERVAL_GET_RESULT             =      15;
/**************************************************Constant**************************************************************/
/***********************************************local Variables**********************************************************/
//record object
//var audioRecorder = new Recorder();
var audioRecorder = null;

//session id
var session_id = null;
var addon_id = null;

//get result function
var func_get_result = null;
var func_display = null;

//sessionbgein params
var params = null;

//browser fingerprint id
var browser_id = new Fingerprint().get();

var rec_state = 'idle';
//vad worker
var vad_worker = null;
//speex worker
var speex_worker = null;
/***********************************************local Variables**********************************************************/

/**
* send session begin message
* varible : params_obj, object for session begin. such as usr, params , eg...
* varible : func
*/
function sessionBegin(params_obj, funcD, funcR)
{
    func_get_result = funcR;
	if(window.waflag != true) func_display = funcD;
	params = params_obj;
	
	regListener();
	
	if(window.waflag != true && audioRecorder == null)
	{
		initMedia();
		return;
	}
	
	//send session begin
	params_obj.params = params_obj.params + ", rse = utf8, browser_id=" + browser_id + ",host=" + document.domain;
	console.log(params_obj);
    sendMessage(KEY_QISR_SESSION_BEGIN, params_obj);
	
	rec_state = 'ssb';
	window.SessionInfo.errorcode = 0;
	window.SessionInfo.result = null;
	
	if(window.waflag != true)
    {	
		recBuffers = [];
		audioRecorder.record(funcD, function(state, audio_data){
			// console.log('audio_data', audio_data);
			sendAudio(state, audio_data, null);
		}, function vadCheck(state){
			if(state == 'end') {
				LOGCAT('local vad spot end');
				getResult(0);
			}
		});
	} else {
	    vad_worker = window.vad;
		vad_worker.postMessage({command: 'init'});
		vad_worker.onmessage = function(e){
			if(e.data.command == "esvad" && e.data.message == 'end') 
			{
				LOGCAT('local vad spot end');
				funcD(null);
				getResult(0);
			}
		};	
		speex_worker = window.compress;
		speex_worker.postMessage({command: 'init'});
		speex_worker.onmessage = function(e){
			if(e.data.command == "encode") {
				var buffer = e.data.buffer;
				var result = new Int8Array(buffer.length);
				for(var i = 0; i < buffer.length; i++)
					result[i] = buffer[i];
				sendAudio(2, result.buffer, null);
			} 
		};
	}
}

function writeAudio(data, state)
{
    if(state == 4)
	{
	    getResult(0);
	    return;
	}
	
	var result = new Int16Array(320);
	for(var i = 0; i < 320; i++)
		result[i] = data[i];
	
    vad_worker.postMessage({
		command : 'appendData',
		pcmData : result,
		nSamples : result.length
	});
	var output = new Int8Array();
	var output_length;
	speex_worker.postMessage({
		command : 'encode',
		inData : result,
		inOffset : 0,
		inCount : result.length,
		outData : output,
		outOffset : 0,
		outCount :output_length
	});	
}

function regListener()
{
    //var SOCKET_IO_URL = 'http://webapi.openspeech.cn:80/ivp' ;
    var SOCKET_IO_URL = window.Connection.socket_url;
	window.socket = io.connect(SOCKET_IO_URL,  { 'reconnection': window.Connection.reconnection, 'reconnectionDelay':window.Connection.reconnectionDelay, 'force new connection': true });

    window.socket.on(KEY_QISR_SESSION_BEGIN, function(obj) {
		if(obj.ret == 0)
		{
			session_id = obj.sessionid; 
			addon_id = obj.addonID;
		}
		else
		{		
			func_get_result(obj.ret, null);
		}
	});	

	window.socket.on(KEY_QISR_AUDIO_WRITE, function(obj) {
		LOGCAT("audio write ,return value : " + obj);
		
		var ret = obj.ret;
		var epStatus = obj.epStatus;
		var verStatus = obj.verStatus;
		
		/* if recstatus equals 0 , send getresult message */
		if(verStatus == 0)
		{
			//getResult(0);
		}
		LOGCAT('audio write , return value :' + ret + ', epStatus : ' + epStatus + ', verStatus : ' + verStatus);
	});	

	window.socket.on(KEY_QISR_GET_RESULT, function(obj) {
		// LOGCAT("get result ,return value : " + obj);
		
		var ret = obj.ret;
		var rslt_status = obj.rslt_status;
		var rslt_err = obj.rslt_err;
		
		if(rec_state != 'grs')
		{
			LOGCAT("has got result.");
			return;
		}
		else if(ret != 0)
		{
			/* --------- need modify --------- */
			window.SessionInfo.errorcode = ret;
			window.SessionInfo.result = null;
			/* --------- need modify --------- */
			
			func_get_result(window.SessionInfo.errorcode, window.SessionInfo.result);
			
			rec_state = 'sse';
			sessionEnd(50);
		}
		else if(rslt_status != 5)
		{
			if(rslt_err != null && rslt_err != undefined && rslt_err != '')
			{
				if(window.SessionInfo.result != null && window.SessionInfo.result != undefined)
					window.SessionInfo.result =  window.SessionInfo.result + rslt_err;
				else if(rslt_err != window.SessionInfo.result)
					window.SessionInfo.result =  rslt_err;
			}
			getResult(INTERVAL_GET_RESULT, func_get_result);
		}
		else if(rslt_status == 5)
		{
			if(window.SessionInfo.result != null && window.SessionInfo.result != undefined)
			{	
				window.SessionInfo.result =  window.SessionInfo.result + rslt_err;
			}
			else if(rslt_err != window.SessionInfo.result)
			{
				window.SessionInfo.result =  rslt_err;
			}
				
			window.SessionInfo.errorcode = ret;
		
			func_get_result(window.SessionInfo.errorcode, window.SessionInfo.result);
			
			rec_state = 'sse';
			sessionEnd(50);
		}
	});	

	window.socket.on(KEY_QISR_SESSION_END, function(obj) {
		LOGCAT("session end ,return value : " + obj);
		
		
	});	

	window.socket.on(KEY_QISR_GET_PARAM, function(obj) {
		LOGCAT("get param ,return value : " + obj);
		
	});	

	window.socket.on(KEY_QISR_SET_PARAM, function(obj) {
		LOGCAT("set param ,return value : " + obj);
	});
}

var recBuffers = [];
var count = 0;
/**
* compress audio data
* varible : params_obj, params for compress. such as speex-wb;7, eg.../
* varible : data, audio pcm( pcm , wav )
* varible : func
*/
function sendAudio(state, data, func)
{	
	if(rec_state == 'grs')
		return;
		
    rec_state = 'auw';	
	if(session_id != null && session_id != undefined && addon_id != null && addon_id != undefined)
	{
		count ++;		
		if(state != 4)
			recBuffers.push(new Int8Array(data));
		
		if(count == 6 || state == 4)
		{
			var output = recBuffers.splice(0, recBuffers.length);
			var outputArray = new Int8Array(output.length * 43);
			for(var i = 0; i < output.length; i++)
				outputArray.set(output[i], i*43);
			sendMessage(KEY_QISR_AUDIO_WRITE, {"addonid" : addon_id, "sessionid" : session_id, "state" : 2, "data" : outputArray.buffer});
			count = 0;
		} 
		
		if(state == 4) {
			sendMessage(KEY_QISR_AUDIO_WRITE, {"addonid" : addon_id, "sessionid" : session_id, "state" : 4, "data" : data});		
		}
	}
}

/**
* get result from server
* varible : wait_time, call getresult function after wait_time.
* varible : func
*/
function getResult(wait_time)
{
    if(window.waflag != true) audioRecorder.stop();
	
	if(rec_state == 'auw')
	{
		var buffer = new ArrayBuffer(2);
		var data = new Int16Array(buffer);
		data[0] = 0;		
		sendAudio(4, data, null);
		if(window.waflag != true) func_display('stop');
		
		rec_state = 'grs';
	}
	
	if(rec_state == 'grs')
	{
		setTimeout('sendMessage(KEY_QISR_GET_RESULT, {"addonid" : addon_id, "sessionid" : session_id})', wait_time);
	}
}

/**
* session end, close the session
* varible : wait_time, call sessionend function after wait_time.
*/
function sessionEnd(wait_time)
{
    if(rec_state == 'sse' && session_id != null)
	{
		setTimeout('sendMessage(KEY_QISR_SESSION_END, {"addonid" : addon_id, "sessionid" : session_id})', wait_time);
		//session_id = null;
	}
	rec_state = 'idle';
}

/**
* getparam from key
* varible : key , call getparam function
*/
function getParam(key)
{
    sendMessage(KEY_QISR_GET_PARAM, {"addonid" : addon_id, "session_id" : session_id, "key" : key});
}

/**
* setparam from key
* varible : key 
* varible : value
*/
function setParam(key, value)
{
    sendMessage(KEY_QISR_SET_PARAM, {"addonid" : addon_id, "session_id" : session_id, "key" : key, "value" : key});
} 

sendMessage = function(filter, message)
{			
	//LOGCAT("send " + filter + " message begin...");
	window.socket.emit(filter, message);
	//LOGCAT("send " + filter + " message end...");
};	

function initMedia() {
	
	if (!navigator.getUserMedia) {
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
		//navigator.getUserMedia = navigator.webkitGetUserMedia;
	}
	if (!navigator.cancelAnimationFrame)
		navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
	if (!navigator.requestAnimationFrame)
		navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;
		
	navigator.getUserMedia({audio:true}, gotStream, function(e) {
		//alert('error');
		func_display(-1);
	});
	window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
	//window.AudioContext = window.webkitAudioContext;
	audioContext = new window.AudioContext();
	if(audioContext == undefined)
	{
		func_display(-1);
	}
}

var audioInput = null,
    realAudioInput = null,
    inputPoint = null,
    audioRecorder = null,
	audioContext = null;
var analyserContext = null;
var canvasWidth, canvasHeight;
var recIndex = 0;
var javascriptNode = null;

function gotStream(stream) {
   inputPoint = audioContext.createGain();

    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

	analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect( analyserNode );

	//alert('init audio recorder');
    audioRecorder = new Recorder(inputPoint);
	//alert('init audio recorder after');
	sessionBegin(params, func_display, func_get_result);
}