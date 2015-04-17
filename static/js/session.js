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
(function(window){

/**
 * ��ʼ���Ự����
 * cfg �Ự����������JSON�ַ����������ò������£�
 *     url                ��     ��Ҫ���ӵķ�������ַ
 *     reconnection       ��     �ͻ����Ƿ�֧�ֶϿ�����
 *     reconnectionDelay  ��     ����֧�ֵ��ӳ�ʱ��   
 *     speex_path         :      speex����·��
 *     vad_path           :      vad����·��
 *     recorder_path      :      recorderWorker����·��
 */
var Session = function(cfg)
{	
    /*
	 * �������ӵĵ�ַ��Ϊ�գ����滻Ĭ�ϵ����ӵ�ַwebapi.openspeech.cn
	 */
	if( cfg.url != undefined && cfg.url != null && cfg.url.indexOf("webapi.openspeech.cn") <= 0) 
	{
	    window.Connection.socket_url = cfg.url;
		//console.log("1 : " + window.Connection.socket_url);
	} else {
	    window.Connection.socket_url = 'http://webapi.openspeech.cn:80/ivp';
	}
	
	/*
	 * ������Ҫ�ⲿд��Ƶ�������ø�TAGΪtrue
	 */
	if( cfg.writeAudio != undefined && cfg.writeAudio != null ) window.waflag = cfg.writeAudio; 
    
	/* ���ÿͻ���������ʱ */
	if( cfg.reconnection != undefined && cfg.reconnection != null ) window.Connection.reconnection = cfg.reconnection;
	if( cfg.reconnectionDelay != undefined && cfg.reconnectionDelay != null ) window.Connection.reconnectionDelay = cfg.reconnectionDelay;
	
	/* initi compress js */
	if(cfg.compress != undefined && cfg.compress != null)
	{
		var WORKER_SPEEX_PATH = "js/common/" + cfg.compress + ".js";
		if(cfg.speex_path != undefined && cfg.speex_path != null)
			window.compress = new Worker(cfg.speex_path);
		else
			window.compress = new Worker(WORKER_SPEEX_PATH);

		var WORKER_VAD_PATH = "js/common/vad.js";
		if(cfg.vad_path != undefined && cfg.vad_path != null)
			window.vad = new Worker(cfg.vad_path);
		else
			window.vad = new Worker(WORKER_VAD_PATH);			
		
		var WORKER_RECORDER_PATH = 'js/audio/recorderWorker.js';
		if(cfg.recorder_path != undefined && cfg.recorder_path != null)
			window.record = new Worker(cfg.recorder_path);
		else
			window.record = new Worker(WORKER_RECORDER_PATH);
	}
	
	/* 
	 * �����°汾������JS�ļ�
	 */
	if( window.BrowserInfo == undefined || window.BrowserInfo == null )
	{
	    document.write("<script src='http://webapi.openspeech.cn:80/js/util/brow.js'><\/script>");
    
	}
		
	/**
	 * ��ʼ����ҵ���Ự
	 * sub ҵ���ֶΣ�iat-��д, tts-�ϳ�, ise-���⣩
	 * param_obj ��������
     * funcD �����ص�����
     * funcR �����ص�����	 
	 */
	this.start = function(sub, params_obj, funcD, funcR)
	{	
	    sessionBegin(params_obj, funcD, funcR);
	}

	/**
	 * ֹͣҵ���Ự���Ի᷵��ҵ��������
	 * param_obj ��������
	 */
	this.stop = function(params_obj)
	{
		getResult(params_obj);
	}
	
	/**
	 * ȡ��ҵ���Ự��������ҵ��������
	 */
	this.cancel = function()
	{
		sessionEnd();
	}
};

window.Session = Session;

})(window); 