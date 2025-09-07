import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheckIcon, 
  CurrencyDollarIcon, 
  ClockIcon,
  UsersIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  GlobeAltIcon,
  TruckIcon,
  DocumentCheckIcon
} from '@heroicons/react/24/outline';
import { LivePriceTicker } from './PriceComponents';
import { AnimatedCounter, FadeIn, FloatingElement } from './Animations';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 card-hover group">
    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

interface StepCardProps {
  number: string;
  title: string;
  description: string;
}

const StepCard: React.FC<StepCardProps> = ({ number, title, description }) => (
  <div className="flex items-start space-x-4">
    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
      {number}
    </div>
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  </div>
);

export function Homepage() {
  const features = [
    {
      icon: <ShieldCheckIcon className="w-6 h-6 text-blue-600" />,
      title: "Secure Escrow",
      description: "Your funds are protected by smart contracts on Solana blockchain until all conditions are met."
    },
    {
      icon: <CurrencyDollarIcon className="w-6 h-6 text-blue-600" />,
      title: "Multi-Token Support",
      description: "Trade with SOL, USDC, USDT, and other SPL tokens with real-time price updates."
    },
    {
      icon: <ClockIcon className="w-6 h-6 text-blue-600" />,
      title: "Milestone Payments",
      description: "Break down large transactions into manageable milestones with automatic payment scheduling."
    },
    {
      icon: <UsersIcon className="w-6 h-6 text-blue-600" />,
      title: "Three-Party System",
      description: "Importer, exporter, and independent verifier ensure fair and transparent transactions."
    },
    {
      icon: <GlobeAltIcon className="w-6 h-6 text-blue-600" />,
      title: "Global Trade",
      description: "Facilitate international trade with automated customs and shipping verification."
    },
    {
      icon: <DocumentCheckIcon className="w-6 h-6 text-blue-600" />,
      title: "Smart Verification",
      description: "AI-powered document verification and compliance checking for seamless transactions."
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Create Order",
      description: "Set up your escrow order with payment terms, delivery conditions, and milestone schedules."
    },
    {
      number: "2",
      title: "Fund Escrow",
      description: "Deposit your tokens into the secure escrow smart contract with transparent terms."
    },
    {
      number: "3",
      title: "Track Progress",
      description: "Monitor shipment progress, milestone completion, and automatic payment releases."
    },
    {
      number: "4",
      title: "Complete Trade",
      description: "Receive your goods and funds are automatically released upon successful delivery."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <ShieldCheckIcon className="w-5 h-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900">SolanaEscrow</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Launch App
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Secure <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Blockchain</span> Escrow
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The most trusted escrow platform for international trade. Powered by Solana blockchain 
              with milestone payments, multi-token support, and smart contract security.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/dashboard"
                className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105"
              >
                Start Trading
                <ArrowRightIcon className="w-5 h-5 ml-2" />
              </Link>
              <Link 
                href="#how-it-works"
                className="inline-flex items-center px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl border border-gray-300 transition-all duration-200"
              >
                How It Works
              </Link>
            </div>

            {/* Live Price Ticker */}
            <div className="bg-white rounded-xl shadow-lg p-4 max-w-4xl mx-auto">
              <div className="text-sm text-gray-500 mb-2 text-center">Live Token Prices</div>
              <LivePriceTicker className="justify-center" />
            </div>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20"></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  $<AnimatedCounter end={2.5} suffix="M+" />
                </div>
                <div className="text-gray-600">Trade Volume</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  <AnimatedCounter end={1200} suffix="+" />
                </div>
                <div className="text-gray-600">Successful Trades</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  <AnimatedCounter end={99.9} suffix="%" />
                </div>
                <div className="text-gray-600">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  <AnimatedCounter end={45} suffix="+" />
                </div>
                <div className="text-gray-600">Countries</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Why Choose SolanaEscrow?
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Built for modern international trade with cutting-edge blockchain technology
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FadeIn key={index} delay={index * 200}>
                <FloatingElement delay={index * 0.2}>
                  <FeatureCard {...feature} />
                </FloatingElement>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simple, secure, and transparent process for international trade
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              {steps.map((step, index) => (
                <StepCard key={index} {...step} />
              ))}
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl p-8">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <TruckIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Electronics Import</h3>
                        <p className="text-sm text-gray-500">Active Order</p>
                      </div>
                    </div>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      In Transit
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Order Value</span>
                      <span className="font-semibold">50,000 USDC</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="text-gray-900">2/3 milestones</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '66%' }}></div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <CheckCircleIcon className="w-4 h-4 text-green-500" />
                      <span>Customs cleared automatically</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Start Trading?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of traders using the most secure escrow platform for international commerce
          </p>
          <Link 
            href="/dashboard"
            className="inline-flex items-center px-8 py-4 bg-white hover:bg-gray-100 text-blue-600 font-semibold rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            Launch App Now
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <ShieldCheckIcon className="w-5 h-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold">SolanaEscrow</span>
              </div>
              <p className="text-gray-400">
                Secure blockchain escrow for international trade
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/create" className="hover:text-white transition-colors">Create Order</Link></li>
                <li><Link href="/orders" className="hover:text-white transition-colors">My Orders</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Connect</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 SolanaEscrow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
