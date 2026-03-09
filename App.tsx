import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, Sparkles, Camera, Layout, Download, Diamond, Clock, ArrowRight } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Concept {
  concept_name: string;
  api_generation_prompt: string;
  lighting_environment: string;
  camera_angle: string;
  placement_instructions: string;
}

interface Analysis {
  material: string;
  gemstone: string;
  style: string;
  lighting_notes: string;
}

export default function App() {
  const [time, setTime] = useState<Date | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [photoshootType, setPhotoshootType] = useState('Product Photoshoot');
  
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayOriginal, setOverlayOriginal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const proceedToAnalysis = async () => {
    if (!image || !imageFile) return;
    setStep(2);
    try {
      const base64Data = image.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { inlineData: { data: base64Data, mimeType: imageFile.type } },
          `Perform a highly detailed, expert-level analysis of this jewelry piece to ensure 100% accurate reproduction in a photoshoot. 
          
          Examine and describe:
          1. Material: Exact metal type (e.g., 18k yellow gold, platinum, rose gold), finish (e.g., high polish, matte, brushed), and texture.
          2. Gemstone: Primary and secondary stones, including cut (e.g., round brilliant, emerald, pear), color, clarity, and setting style (e.g., prong, bezel, pavé).
          3. Style: The overall design aesthetic (e.g., vintage, modern minimalist, art deco, bridal) and key structural features.
          4. Lighting Notes: The exact lighting conditions in the image, including specular highlights, shadow softness, reflection patterns on the metal, and light refraction in the gemstones.
          
          Return a strict JSON object with these keys: 'material' (string), 'gemstone' (string), 'style' (string), 'lighting_notes' (string). Do not include markdown.`
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.OBJECT,
             properties: {
               material: { type: Type.STRING },
               gemstone: { type: Type.STRING },
               style: { type: Type.STRING },
               lighting_notes: { type: Type.STRING }
             }
          }
        }
      });
      if (response.text) {
        setAnalysis(JSON.parse(response.text));
      }
    } catch (err) {
      console.error("Analysis failed", err);
    }
    setStep(3);
  };

  const generateImageForConcept = async (index: number, concept: Concept, base64Data: string) => {
    setGeneratingImages(prev => ({ ...prev, [index]: true }));
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: imageFile!.type } },
            { text: `CRITICAL INSTRUCTION: When generating images, ensure the uploaded jewelry is 100% pixel-perfect identical to the original. Focus on replicating precise material finish, gemstone clarity, and all reflections. DO NOT alter the jewelry's shape, color, or details under any circumstances. ONLY generate the surrounding environment.\n\nBackground Environment: ${concept.api_generation_prompt}\nLighting: ${concept.lighting_environment}\nCamera Angle: ${concept.camera_angle}\nPlacement: ${concept.placement_instructions}` }
          ]
        },
        config: {
          // @ts-ignore
          imageConfig: { aspectRatio }
        }
      });

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setGeneratedImages(prev => ({ ...prev, [index]: imageUrl }));
      }
    } catch (err: any) {
      console.error("Failed to generate image", index, err);
    } finally {
      setGeneratingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const generateAllImages = async () => {
    if (!concepts || !image) return;
    setIsGeneratingAll(true);
    
    const base64Data = image.split(',')[1];
    for (let i = 0; i < concepts.length; i++) {
      if (!generatedImages[i]) {
        await generateImageForConcept(i, concepts[i], base64Data);
      }
    }
    
    setIsGeneratingAll(false);
  };

  const generateCampaign = async () => {
    if (!image) return;
    setStep(4);
    setConcepts(null);
    setGeneratedImages({});
    setGeneratingImages({});
    setError(null);

    try {
      const base64Data = image.split(',')[1];
      const prompt = `
Objective: Deeply analyze the uploaded jewelry image and user parameters to generate exactly three distinct, high-end photography concepts formatted as a strict JSON array.

Context & Constraints:
These prompts will be fed into a specialized image-generation API using compositing/inpainting. The original jewelry image will be seamlessly overlaid onto the generated background/model to ensure 100% product accuracy.
You must ensure the environmental lighting, shadows, and reflections in the generated prompts perfectly match the lighting and physical properties of the original uploaded jewelry.

Step 1: Deep Visual Analysis:
Material: ${analysis?.material || 'Unknown'}
Gemstone: ${analysis?.gemstone || 'Unknown'}
Style: ${analysis?.style || 'Unknown'}

Step 2: Concept Generation Logic:
Photoshoot Type: ${photoshootType}
If "Product Photoshoot": Generate 3 entirely distinct creative environments. Focus on luxury display props, macro-photography aesthetics, and dramatic commercial lighting.
If "Model Photoshoot": Generate 3 entirely distinct high-end editorial model setups. Specify the model's appearance, realistic skin textures, and precise anatomical placement of the jewelry.

Step 3: JSON Formatting:
You must return a strict JSON array containing exactly 3 objects. Do not include markdown formatting or extra conversational text outside the JSON.
Each object must use the following schema:
- "concept_name": A short title for the creative direction.
- "api_generation_prompt": The highly detailed, comma-separated descriptive prompt for the image generator. Include the aspect ratio parameter ${aspectRatio} at the end.
- "lighting_environment": Specific lighting instructions that match the original jewelry.
- "camera_angle": The exact perspective required to match the uploaded image.
- "placement_instructions": Instructions for where the composite jewelry should sit in the frame or on the model.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { inlineData: { data: base64Data, mimeType: imageFile!.type } },
          prompt
        ],
        config: {
          systemInstruction: "You are a Master Commercial Jewelry Photography Director and an Expert AI Image Prompt Engineer.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                concept_name: { type: Type.STRING },
                api_generation_prompt: { type: Type.STRING },
                lighting_environment: { type: Type.STRING },
                camera_angle: { type: Type.STRING },
                placement_instructions: { type: Type.STRING }
              },
              required: ["concept_name", "api_generation_prompt", "lighting_environment", "camera_angle", "placement_instructions"]
            }
          }
        }
      });

      if (response.text) {
        const parsedConcepts = JSON.parse(response.text);
        setConcepts(parsedConcepts);
        
        // Auto-generate images
        parsedConcepts.forEach((concept: Concept, index: number) => {
          generateImageForConcept(index, concept, base64Data);
        });
      } else {
        throw new Error("No response from AI");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while generating concepts.");
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white font-sans selection:bg-gold/20">
      {/* Top Bar */}
      <header className="h-20 border-b border-dark-border bg-dark-bg/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setStep(1)}>
          <Diamond className="w-6 h-6 text-gold" />
          <h1 className="font-serif text-2xl tracking-widest text-white">LUMIÈRE</h1>
        </div>
        <div className="flex items-center gap-3 text-white/60 font-mono text-xs uppercase tracking-widest">
          <Clock className="w-4 h-4 text-gold/70" />
          {time ? `${time.toLocaleDateString()} ${time.toLocaleTimeString()}` : 'Loading time...'}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
            <div className="max-w-2xl w-full space-y-10">
              <div className="text-center space-y-4">
                <h2 className="font-serif text-5xl font-light text-white">Upload Asset</h2>
                <p className="text-white/40 font-light text-lg">Provide a high-resolution image of your jewelry piece to begin the AI art direction process.</p>
              </div>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`relative border-2 border-dashed rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 group
                  ${image ? 'border-gold/30 bg-dark-surface' : 'border-dark-border hover:border-gold/50 bg-dark-surface/50'} 
                  aspect-[2/1] flex flex-col items-center justify-center text-center p-8`}
              >
                {image ? (
                  <>
                    <img src={image} alt="Uploaded jewelry" className="absolute inset-0 w-full h-full object-contain p-6 transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-dark-bg/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                      <p className="text-xs font-display uppercase tracking-[0.2em] text-white flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Replace Asset
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full border border-dark-border flex items-center justify-center mb-6 group-hover:border-gold/50 group-hover:bg-dark-surface transition-all duration-500">
                      <Upload className="w-6 h-6 text-white/30 group-hover:text-gold transition-colors" />
                    </div>
                    <p className="text-sm font-display uppercase tracking-[0.15em] text-white/80 mb-2">Upload Product</p>
                    <p className="text-xs text-white/30 font-light">Drag & drop high-res image</p>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>

              <button
                onClick={proceedToAnalysis}
                disabled={!image}
                className="w-full bg-gold text-black py-5 rounded-2xl font-display text-sm uppercase tracking-[0.2em] font-bold hover:bg-white transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(212,175,55,0.15)]"
              >
                Proceed to Analysis <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="relative w-32 h-32 mb-12">
              <div className="absolute inset-0 border border-gold/10 rounded-full" />
              <div className="absolute inset-0 border border-gold rounded-full border-t-transparent animate-[spin_2s_linear_infinite]" />
              <div className="absolute inset-4 border border-gold/20 rounded-full animate-[spin_3s_linear_infinite_reverse]" />
              <Diamond className="absolute inset-0 m-auto w-8 h-8 text-gold animate-pulse" />
            </div>
            <h2 className="font-serif text-4xl font-light mb-4 text-white">Analyzing Asset</h2>
            <p className="text-xs font-display uppercase tracking-[0.3em] text-white/40">Extracting physical properties & lighting data...</p>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex items-center justify-center p-8 animate-in fade-in duration-700">
            <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Left: Preview & Analysis */}
              <div className="space-y-8">
                <div className="aspect-square rounded-3xl bg-dark-surface border border-dark-border p-8 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-gold/5 to-transparent pointer-events-none" />
                  <img src={image!} className="max-w-full max-h-full object-contain relative z-10" />
                </div>
                
                {analysis && (
                  <div className="bg-dark-surface border border-dark-border rounded-2xl p-8 grid grid-cols-2 gap-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gold" />
                    <div>
                      <div className="text-[10px] font-display text-white/40 uppercase tracking-[0.2em] mb-2">Material</div>
                      <div className="text-sm font-light text-white/90">{analysis.material}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-display text-white/40 uppercase tracking-[0.2em] mb-2">Gemstone</div>
                      <div className="text-sm font-light text-white/90">{analysis.gemstone}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] font-display text-white/40 uppercase tracking-[0.2em] mb-2">Style Profile</div>
                      <div className="text-sm font-light text-white/90">{analysis.style}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] font-display text-white/40 uppercase tracking-[0.2em] mb-2">Deep Lighting & Detail Analysis</div>
                      <div className="text-sm font-light text-white/90 leading-relaxed">{analysis.lighting_notes}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Configuration */}
              <div className="flex flex-col justify-center space-y-12">
                <div>
                  <h2 className="font-serif text-5xl font-light text-white mb-4">Campaign Setup</h2>
                  <p className="text-white/40 font-light text-lg">Configure the parameters for your AI-generated photoshoot.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <label className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-3">
                      <Layout className="w-4 h-4 text-gold" />
                      Canvas Ratio
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {['1:1', '4:3', '16:9', '3:4', '9:16'].map(ratio => (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`py-4 text-xs font-display rounded-xl border transition-all duration-300 ${
                            aspectRatio === ratio 
                              ? 'border-gold bg-gold text-black shadow-[0_0_20px_rgba(212,175,55,0.2)]' 
                              : 'border-dark-border hover:border-white/20 bg-dark-surface text-white/60'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <label className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/50 flex items-center gap-3">
                      <Camera className="w-4 h-4 text-gold" />
                      Photography Style
                    </label>
                    <div className="grid grid-cols-1 gap-4">
                      {['Product Photoshoot', 'Model Photoshoot'].map(type => (
                        <button
                          key={type}
                          onClick={() => setPhotoshootType(type)}
                          className={`py-5 px-6 text-xs font-display rounded-2xl border text-left transition-all duration-300 flex items-center justify-between group ${
                            photoshootType === type 
                              ? 'border-gold bg-gold text-black shadow-[0_0_20px_rgba(212,175,55,0.2)]' 
                              : 'border-dark-border hover:border-white/20 bg-dark-surface text-white/60'
                          }`}
                        >
                          {type}
                          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${photoshootType === type ? 'bg-black scale-150' : 'bg-white/20'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={generateCampaign}
                    className="w-full bg-white text-black py-5 rounded-2xl font-display text-sm uppercase tracking-[0.2em] font-bold hover:bg-gold transition-all duration-500 flex items-center justify-center gap-3"
                  >
                    <Sparkles className="w-5 h-5" /> Generate 3 Views
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 overflow-y-auto p-8 lg:p-16">
            {!concepts ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 mb-12">
                  <div className="absolute inset-0 border border-gold/10 rounded-full" />
                  <div className="absolute inset-0 border border-gold rounded-full border-t-transparent animate-[spin_2s_linear_infinite]" />
                  <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-gold animate-pulse" />
                </div>
                <h2 className="font-serif text-4xl font-light mb-4 text-white">Drafting Concepts</h2>
                <p className="text-xs font-display uppercase tracking-[0.3em] text-white/40">Synthesizing creative directions...</p>
              </div>
            ) : (
              <div className="max-w-7xl mx-auto space-y-16 pb-24">
                <div className="border-b border-dark-border pb-10 flex flex-col items-center text-center relative">
                  <p className="text-[10px] font-display uppercase tracking-[0.3em] text-gold mb-4">Campaign Results</p>
                  <h2 className="font-serif text-5xl font-light text-white mb-8">{photoshootType}</h2>
                  
                  <div className="flex items-center gap-3 bg-dark-surface border border-dark-border px-6 py-3 rounded-full">
                    <div className="text-[10px] font-display uppercase tracking-[0.2em] text-white/70">100% Accuracy Overlay</div>
                    <button 
                      onClick={() => setOverlayOriginal(!overlayOriginal)}
                      className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${overlayOriginal ? 'bg-gold' : 'bg-dark-border'}`}
                    >
                      <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${overlayOriginal ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[9px] font-display uppercase tracking-[0.1em] text-white/30 mt-3 mb-8">Enable to overlay original image (Best for white backgrounds)</p>
                  
                  <button 
                    onClick={generateAllImages}
                    disabled={isGeneratingAll || Object.keys(generatingImages).some(k => generatingImages[parseInt(k)])}
                    className="bg-gold text-black px-8 py-4 rounded-full text-[10px] font-display uppercase tracking-[0.2em] font-bold flex items-center gap-3 hover:bg-white transition-all duration-500 disabled:opacity-50 shadow-[0_0_30px_rgba(212,175,55,0.2)]"
                  >
                    {isGeneratingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    Generate All Views At Once
                  </button>
                </div>

                <div className="space-y-24">
                  {concepts.map((concept, index) => (
                    <div key={index} className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-center">
                      {/* Left: Image */}
                      <div className="xl:col-span-7 order-2 xl:order-1">
                        <div className="relative rounded-3xl overflow-hidden bg-dark-surface border border-dark-border shadow-2xl" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                          {generatedImages[index] ? (
                            <>
                              <img src={generatedImages[index]} alt={concept.concept_name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 hover:scale-105" />
                              {overlayOriginal && (
                                <img src={image!} alt="Original Overlay" className="absolute inset-0 w-full h-full object-contain mix-blend-multiply opacity-100 pointer-events-none" />
                              )}
                            </>
                          ) : generatingImages[index] ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-bg/50 backdrop-blur-md">
                              <Loader2 className="w-10 h-10 text-gold animate-spin mb-6" />
                              <span className="text-[10px] font-display uppercase tracking-[0.3em] text-white/50">Rendering Visual...</span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-dark-border m-6 rounded-2xl">
                              <ImageIcon className="w-10 h-10 text-white/10 mb-4" />
                              <span className="text-[10px] font-display uppercase tracking-[0.2em] text-white/20">Awaiting Render</span>
                            </div>
                          )}
                          
                          {generatedImages[index] && (
                            <div className="absolute bottom-6 right-6 flex gap-3">
                              <button
                                onClick={() => downloadImage(generatedImages[index], `concept-${index + 1}.png`)}
                                className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-gold hover:text-black transition-all duration-300"
                              >
                                <Download className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Details */}
                      <div className="xl:col-span-5 space-y-10 order-1 xl:order-2">
                        <div className="space-y-4">
                          <div className="text-gold font-serif text-6xl font-light opacity-50 leading-none">0{index + 1}</div>
                          <h3 className="font-serif text-4xl font-light text-white">{concept.concept_name}</h3>
                        </div>

                        <div className="space-y-6">
                          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gold/50" />
                            <label className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-white/30 mb-3 block">Lighting & Environment</label>
                            <p className="text-sm font-light text-white/80 leading-relaxed">{concept.lighting_environment}</p>
                          </div>

                          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gold/50" />
                            <label className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-white/30 mb-3 block">Camera & Placement</label>
                            <p className="text-sm font-light text-white/80 leading-relaxed mb-4">{concept.camera_angle}</p>
                            <p className="text-sm font-light text-white/80 leading-relaxed">{concept.placement_instructions}</p>
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            onClick={() => generateImageForConcept(index, concept, image!.split(',')[1])}
                            disabled={generatingImages[index]}
                            className="px-8 py-4 bg-dark-surface border border-dark-border text-white rounded-full text-[10px] font-display uppercase tracking-[0.2em] hover:border-gold hover:text-gold transition-all duration-500 disabled:opacity-30 flex items-center gap-3"
                          >
                            {generatingImages[index] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {generatedImages[index] ? 'Regenerate Visual' : 'Synthesize Visual'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
