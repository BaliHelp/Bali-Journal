import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const alt = 'Bali Journal - Investigative Journalism'
export const size = {
    width: 1200,
    height: 630,
}

export const contentType = 'image/png'

// Image generation
export default async function Image() {

    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    background: 'linear-gradient(to bottom right, #000000, #1a1a1a)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'sans-serif',
                    color: 'white',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
                    }}
                />

                {/* Logo Text/Icon Simulation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#fff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontSize: '40px',
                        fontWeight: 'bold'
                    }}>
                        NB
                    </div>
                    <h1 style={{ fontSize: '80px', fontWeight: 'bold', margin: 0, letterSpacing: '-2px' }}>Bali Journal</h1>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ fontSize: '30px', margin: 0, opacity: 0.8, fontWeight: 300, letterSpacing: '4px', textTransform: 'uppercase' }}>
                        Independent Investigative Journalism
                    </p>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: '30px', fontSize: '20px' }}>Tourism</div>
                        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: '30px', fontSize: '20px' }}>Investment</div>
                        <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: '30px', fontSize: '20px' }}>Local</div>
                    </div>
                </div>
            </div>
        ),
        // ImageResponse options
        {
            // For convenience, we can re-use the exported opengraph-image size config
            ...size,
        }
    )
}
