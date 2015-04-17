#coding:utf-8
import os
import json
import time
import StringIO
import tornado.web
import tornado.ioloop
from hashlib import md5
from dejavu import Dejavu
from dejavu.recognize import FileRecognizer

# load config from a JSON file (or anything outputting a python dictionary)
with open("dejavu.cnf") as f:
    config = json.load(f)

PORT = 13982
SETTINGS = {
 "template_path": os.path.join(os.path.dirname(__file__), "templates"),
 "static_path": os.path.join(os.path.dirname(__file__), "static"),
 # "login_url":'/login',
 # "cookie_secret": '6d791ffb386be8ca0c75cbce9b13cc6d',#md5 for zephor
 "debug":True
}

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        try:
            self.get_argument('pc')
        except:
            self.render("index.html")
        else:
            self.render("pc.html")


    def post(self):
        self.set_header('Content-Type', 'application/json;charset=utf-8')
        op=self.get_argument('op')
        res = {
            'status': True,
            'data': None
        }
        if op == 'w':
            kw = self.get_argument('kword')
            res['data'] = kw
        elif op == 'a':
            res['data'] = self.msearch()
        # for aud in self.request.files:
        #     aud=self.request.files[aud]
        #     if len(aud)<1:
        #         self.write(u'上传失败')
        #         return
        #     _t=aud[0]['content_type']
        #     if _t not in types:
        #         self.write(u'上传文件有误，请回去重新上传')
        #         return
        #     fname=md5(aud[0]['filename']+str(time())).hexdigest()
        #     fname+='.png'
        #     if not _op.exists(_uploadFolder+fid):
        #         os.mkdir(_uploadFolder+fid)
        #     #f=open(_uploadFolder+fid+_op.sep+fname, 'wb')
        #     try:
        #         img = Image.open(StringIO.StringIO(aud[0]['body']))
        # song = djv.recognize(FileRecognizer, "mp3/Sean-Fournier--Falling-For-You.mp3")
        self.write(json.dumps(res))

    def msearch(self):
        types=('audio/wav','audio/mp3')
        for aud in self.request.files:
            print aud
            aud=self.request.files[aud]
            if len(aud)<1:
                return u'上传失败'
            _t=aud[0]['content_type']
            if _t not in types:
                return u'上传文件有误，请回去重新上传'
            print 
            fname=md5(aud[0]['filename']+str(time.time())).hexdigest()
            fname+='.wav'
            fname = os.path.join('temp', fname)
            # print type()
            with open(fname, 'wb') as f:
                f.write(aud[0]['body'])

        try:
            djv = Dejavu(config)
            print 'begint recognize...'
            song = djv.recognize(FileRecognizer, fname)
        except Exception as e:
            song = str(e)
        finally:
            # os.remove(fname)
            pass
        print 'recognize: ', song
        return song


application = tornado.web.Application([
    (r"/index.html", MainHandler),
    (r"/sm", MainHandler),
], **SETTINGS)


if __name__ == "__main__":
    application.listen(PORT)
    print 'Development server is running at http://127.0.0.1:%s/' % PORT
    print 'Quit the server with CONTROL-C'
    tornado.ioloop.IOLoop.instance().start()