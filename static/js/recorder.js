/*
 modify by : cyhu(viskey.hu@gmail.com) 2014.4
 modify by : cyhu 2014.6.26

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

(function(window){
    
	var Recorder = function(source, cfg){
    var _this = this;
    var config = cfg || {};
    var bufferLen = getBufferSize();
	var outputArray = new Int8Array(258);
	var count = 0;
    //var outputBufferLength = config.outputBufferLength || 4000;
	//var outputBufferLength = config.outputBufferLength || 320;
	var compressPath = config.compressPath;
    this.context = source.context;
    this.node = this.context.createScriptProcessor(bufferLen, 1, 1);
    var record_worker = window.record;
	
	var funcSendAudio = null;
	var funcDisplay = null;
	var funcVadCheck = null;
	var vad_worker = null;
	var speex_worker = null;
	
	//if recording equals false , stop record . 
    //if recording equals true , start record . 	
	var recording = false;
	
	var outputArray = new Int8Array(258);
	var count = 0;
	var wait_count = 0;
	var isEnd = false;
	
	var speexWbFrameLen = [ 10, 15, 20, 25, 32, 42, 52, 60, 70, 86, 106 ];


    this.audioData = {
        size: 0          //录音文件长度
        , buffer: []     //录音缓存
        , inputSampleRate: _this.context.sampleRate    //输入采样率
        , inputSampleBits: 16       //输入采样数位 8, 16
        , outputSampleRate: 44100    //输出采样率
        , oututSampleBits: 16       //输出采样数位 8, 16
        , reset: function(){
            this.buffer = [];
            this.size = 0;
        }
        , input: function (data) {
            // _data = data;
            this.buffer.push(new Float32Array(data));
            this.size += data.length;
        }
        , compress: function (compress) { //合并压缩
            //合并
            var data = new Float32Array(this.size);
            var offset = 0;
            for (var i = 0; i < this.buffer.length; i++) {
                data.set(this.buffer[i], offset);
                offset += this.buffer[i].length;
            }
            if(compress !== true) return data;
            //压缩
            var compression = this.inputSampleRate / this.outputSampleRate;
            var length = Math.round((data.length*this.outputSampleRate)/this.inputSampleRate);
            var jump = Math.round(data.length/(data.length - length-1));
            var result = new Float32Array(length);
            var index = 0, j = 0;
            while (index < length) {
                if(!(j%jump)){
                    j++;
                    continue;
                }
                result[index] = data[j];
                j++;
                index++;
            }
            return result;
        }
        , encodeWAV: function () {
            var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
            var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
            var bytes = this.compress(true);
            var dataLength = bytes.length * (sampleBits / 8);
            var buffer = new ArrayBuffer(44 + dataLength);
            var data = new DataView(buffer);

            var channelCount = 1;//单声道
            var offset = 0;

            var writeString = function (str) {
                for (var i = 0; i < str.length; i++) {
                    data.setUint8(offset + i, str.charCodeAt(i));
                }
            }
            
            // 资源交换文件标识符 
            writeString('RIFF'); offset += 4;
            // 下个地址开始到文件尾总字节数,即文件大小-8 
            data.setUint32(offset, 36 + dataLength, true); offset += 4;
            // WAV文件标志
            writeString('WAVE'); offset += 4;
            // 波形格式标志 
            writeString('fmt '); offset += 4;
            // 过滤字节,一般为 0x10 = 16
            data.setUint32(offset, 16, true); offset += 4;
            // 格式类别 (PCM形式采样数据) 
            data.setUint16(offset, 1, true); offset += 2;
            // 通道数 
            data.setUint16(offset, channelCount, true); offset += 2;
            // 采样率,每秒样本数,表示每个通道的播放速度
            data.setUint32(offset, sampleRate, true); offset += 4;
            // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8 
            data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;
            // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8 
            data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;
            // 每样本数据位数 
            data.setUint16(offset, sampleBits, true); offset += 2;
            // 数据标识符 
            writeString('data'); offset += 4;
            // 采样数据总数,即数据总大小-44 
            data.setUint32(offset, dataLength, true); offset += 4;
            // 写入采样数据
            if (sampleBits === 8) {
                for (var i = 0; i < bytes.length; i++, offset++) {
                    var s = Math.max(-1, Math.min(1, bytes[i]));
                    var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    val = parseInt(255 / (65535 / (val + 32768)));
                    data.setInt8(offset, val, true);
                }
            } else {
                for (var i = 0; i < bytes.length; i++, offset += 2) {
                    var s = Math.max(-1, Math.min(1, bytes[i]));
                    data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
            }
            return new Blob([data], { type: 'audio/wav' });
        }
    };
	
	function getBufferSize() {
		if (/(Win(dows )?NT 6\.2)/.test(navigator.userAgent)) {
			return 1024;  //Windows 8
		} else if (/(Win(dows )?NT 6\.1)/.test(navigator.userAgent)) {
			return 1024;  //Windows 7
		} else if (/(Win(dows )?NT 6\.0)/.test(navigator.userAgent)) {
			return 2048;  //Windows Vista
		} else if (/Win(dows )?(NT 5\.1|XP)/.test(navigator.userAgent)) {
			return 4096;  //Windows XP
		} else if (/Mac|PPC/.test(navigator.userAgent)) {
			return 1024;  //Mac OS X
		} else if (/Linux/.test(navigator.userAgent)) {
			return 8192;  //Linux
		} else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
			return 2048;  //iOS
		} else {
			return 16384;  //Otherwise
		}
	};
	
    record_worker.postMessage({
      command: 'init',
      config: {
	    compressPath:compressPath,
        sampleRate: this.context.sampleRate,
        outputBufferLength: bufferLen
      }
    });
	
    this.node.onaudioprocess = function(e){
	    if (!recording) return;
		
		/**var output = new Float32Array(e.inputBuffer.getChannelData(0).length);
		for(var i = 0; i < e.inputBuffer.getChannelData(0).length; i++)
			output[i] = e.inputBuffer.getChannelData(0)[i];
		
		window.socket.emit("resample_data", output.buffer);**/
        var _buf = e.inputBuffer.getChannelData(0);
        _this.audioData.input(_buf);
		record_worker.postMessage({
			command: 'record',
			buffer: _buf
		});
		isEnd = false;
    }

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }
 
	var flag = false;
 
    this.record = function(func_display, func_send_audio, func_vad_check){
	
    	recording = true;
		funcSendAudio = func_send_audio;
		funcDisplay = func_display;
		funcVadCheck = func_vad_check;
		count = 0;
		wait_count = 0;
		
        this.audioData.reset();
		record_worker.postMessage({command: 'reset'});
		vad_worker = window.vad;
		vad_worker.postMessage({command: 'init'});
	    vad_worker.onmessage = function(e){
			if(e.data.type == "debug"){
				//postMessage({type:"debug", message:e.data.message}); 
				//LOGCAT(e.data.message);
			} else if(e.data.command == "esvad") {
				funcVadCheck(e.data.message);
				//recording = false;
			} else if(e.data.command == "volume") {
				//postMessage({command:"volume", message:e.data.message});
				//do nothing
			}
	    };
		
		speex_worker = window.compress;
	    speex_worker.postMessage({command: 'init'});
		speex_worker.onmessage = function(e){
			if(e.data.type == "debug"){
				//postMessage({type:"debug", message:e.data.message}); 
				//LOGCAT(e.data.message);
			} else if(e.data.command == "encode") {
				var buffer = e.data.buffer;
				var result = new Int8Array(buffer.length);
				for(var i = 0; i < buffer.length; i++)
					result[i] = buffer[i];
				funcSendAudio(2, result.buffer);
			} 
	    };
    }
	
    this.stop = function(){
    	recording = false;
    }

	
    record_worker.onmessage = function(e){
		if(e.data.type == "debug"){
    		//LOGCAT(e.data.message);
    	} else if(e.data.command == "esvad"){
			//funcVadCheck(e.data.message);
		} else if(e.data.command == "volume"){
			//not used.
		} else {
    		//return audio data			
			funcDisplay(e.data.volume);
			
			var buffer = e.data.buffer;
			var result = new Int16Array(buffer.length);
			for(var i = 0; i < buffer.length; i++)
				result[i] = buffer[i];
			//window.socket.emit("resample_data", result.buffer);
			vad_worker.postMessage({
				command : 'appendData',
				pcmData : result,
				nSamples : result.length
			});
			
			var output = new Int8Array();
			var output_length;
			
			wait_count ++;
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
      
    }
    
	source.connect(this.node);
    this.node.connect(this.context.destination); 
  };

  window.Recorder = Recorder;

})(window);

