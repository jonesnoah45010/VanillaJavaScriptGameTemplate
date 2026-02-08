from flask import Flask, render_template, jsonify, request
import mimetypes

mimetypes.add_type('application/wasm', '.wasm')


app = Flask(__name__)


@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template("index.html")


@app.route('/basic_game', methods=['GET', 'POST'])
def basic_game():
    return render_template("basic_game.html")

if __name__ == '__main__':
    app.run(debug=True,  host='0.0.0.0', port = 8080)







