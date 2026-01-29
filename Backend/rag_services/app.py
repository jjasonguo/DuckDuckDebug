from rag_chain import final_rag_chain1, final_rag_chain2, filtering_chain, refresh_vectorstore
import rag_chain  # Import module to access mutable retriever
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from elevenlabs import ElevenLabs
import openai
import tempfile
import os

app = Flask(__name__)
CORS(app)

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

@app.route("/query", methods=["POST"])
def query():
    question = request.json.get("question")
    try:
        working = filtering_chain.invoke({"question": question})
        print (working)
        if working == "0":
            answer = final_rag_chain1.invoke({"question": question})
        else:
            answer = final_rag_chain2.invoke({"question": question})
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/process_audio', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']

    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        audio_file.save(temp_audio.name)

        try:
            with open(temp_audio.name, "rb") as file:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=file
                )
            return jsonify({'transcription': transcript.text})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            os.remove(temp_audio.name)

@app.route('/tts', methods=['POST'])
def text_to_speech():
    try:
        # Get text from request
        data = request.json
        text = data.get('text')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Use ElevenLabs client to convert text to speech
        audio = elevenlabs_client.text_to_speech.convert(
            voice_id="vDIugAdS5Kvhnm7nVYQ7",
            text=text,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        
        # Save temporary audio file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio:
            for chunk in audio:
                temp_audio.write(chunk)
            temp_path = temp_audio.name
            
        # Return the audio file path
        return jsonify({'audio_url': f'/audio/{os.path.basename(temp_path)}'})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add a route to serve the audio files
@app.route('/audio/<filename>', methods=['GET'])
def get_audio(filename):
    try:
        # Construct the path to the temporary file
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, filename)
        
        # Check if file exists
        if not os.path.exists(file_path):
            return jsonify({'error': 'Audio file not found'}), 404
            
        # Return the audio file
        return send_file(file_path, mimetype='audio/mpeg')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route("/refresh", methods=["POST"])
def refresh():
    """Refresh the vectorstore after code upload."""
    try:
        success = refresh_vectorstore()
        if success:
            return jsonify({"message": "Vectorstore refreshed successfully."})
        else:
            return jsonify({"message": "No documents found. Vectorstore not initialized."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get_retrieved_code", methods=["POST"])
def get_retrieved_code():
    data = request.get_json()
    question = data.get("question", "")
    
    if rag_chain.retriever is None:
        return jsonify({"error": "No code documents loaded. Please upload code first."}), 400
    
    docs = rag_chain.retriever.get_relevant_documents(question)
    top2 = docs[:5]
    return jsonify([
        {"content": doc.page_content, "metadata": doc.metadata}
        for doc in top2
    ])

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5001)
